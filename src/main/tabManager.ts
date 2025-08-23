import { BrowserWindow, WebContentsView, shell, clipboard, Menu, app, ipcMain } from "electron";
import path from "node:path";

import { openWinContextMenu } from "./winContextMenu";
import { DEFAULT_HOME, isAllowed } from "../utils";

type TabMeta = { id: number; title: string; url: string; favicon?: string; isActive: boolean };

export class TabManager {
	private win: BrowserWindow;
	private order: number[] = [];
	private tabs = new Map<number, { view: WebContentsView; title: string; url: string; favicon?: string }>();
	private activeId: number | null = null;
	private nextId = 1;
	private headerHeight = 93;

	public onState?: (state: TabMeta[], activeId: number | null) => void;

	constructor(win: BrowserWindow) {
		this.win = win;
		this.win.on("resize", () => this.layoutActiveView());
	}

	private layoutActiveView() {
		if (this.activeId === null) return;
		const { width, height } = this.win.getContentBounds();
		const view = this.tabs.get(this.activeId)!.view;
		view.setBounds({ x: 0, y: this.headerHeight, width, height: height - this.headerHeight });
	}

	list(): TabMeta[] {
		return this.order.map((id) => {
			const t = this.tabs.get(id)!;
			return { id, title: t.title || "New Tab", url: t.url, favicon: t.favicon, isActive: id === this.activeId };
		});
	}

	async newTab(url = DEFAULT_HOME, opts: { activate?: boolean; awaitLoad?: boolean } = {}) {
		const { activate = true, awaitLoad = true } = opts;

		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(__dirname, "../preload/index.js"),
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
				webSecurity: true,
				spellcheck: true,
			},
		});
		const id = this.nextId++;
		this.tabs.set(id, { view, title: "Loading…", url });
		this.order.push(id);

		const wc = view.webContents;

		const locale = app.getLocale().replace("_", "-"); // e.g. en-US
		const langs = Array.from(new Set([locale, "en-US"].filter(Boolean)));
		wc.session.setSpellCheckerLanguages(langs);

		wc.on("context-menu", (_e, params) => {
			const acts: Record<string, () => void> = {
				back: () => wc.canGoBack() && wc.goBack(),
				fwd: () => wc.canGoForward() && wc.goForward(),
				reload: () => wc.reload(),
				copy: () => clipboard.writeText(params.selectionText || ""),
				insp: () => wc.inspectElement(params.x, params.y),
			};

			// ---- Spellcheck suggestions ----
			const isMisspell = !!params.misspelledWord && (params.isEditable || params.selectionText?.length);
			const sugs = isMisspell ? (params.dictionarySuggestions || []).slice(0, 5) : [];

			// For each suggestion, focus the webview and replace the misspelling.
			sugs.forEach((s, i) => {
				acts[`sug-${i}`] = () => {
					wc.focus(); // ensure target editor has focus
					try {
						// Preferred: replaces the misspelled range under the caret/selection.
						wc.replaceMisspelling(s);
					} catch {
						// Fallback: insert at caret (works in <input>, <textarea>, contentEditable)
						wc.insertText(s);
					}
				};
			});

			if (params.misspelledWord) {
				acts["add-word"] = () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord!);
			}

			if (params.linkURL) {
				const url = params.linkURL;

				// Check allow list, if not allowed open external
				acts["open-link"] = () => (!isAllowed(url) ? shell.openExternal(url) : this.newTab(url));
				acts["copy-link"] = () => clipboard.writeText(url);
			}
			if (params.mediaType === "image" && params.srcURL) {
				const url = params.srcURL;
				acts["open-img"] = () => (!isAllowed(url) ? shell.openExternal(url) : this.newTab(url));
				acts["copy-img"] = () => clipboard.writeText(url);
			}

			const items = [
				{ id: "back", label: "Back", enabled: wc.canGoBack() },
				{ id: "fwd", label: "Forward", enabled: wc.canGoForward() },
				{ id: "reload", label: "Reload" },
				{ id: "sep", label: "" },
				...(params.linkURL
					? [
							{ id: "open-link", label: "Open link" },
							{ id: "copy-link", label: "Copy link address" },
							{ id: "sep", label: "" },
					  ]
					: []),
				...(params.mediaType === "image" && params.srcURL
					? [
							{ id: "open-img", label: "Open image" },
							{ id: "copy-img", label: "Copy image address" },
							{ id: "sep", label: "" },
					  ]
					: []),
				...(params.selectionText
					? [
							{ id: "copy", label: "Copy" },
							{ id: "sep", label: "" },
					  ]
					: []),
				...(sugs.length ? sugs.map((s, i) => ({ id: `sug-${i}`, label: s })) : []),
				...(params.misspelledWord ? [{ id: "add-word", label: "Add to dictionary" }] : []),
				...(sugs.length || params.misspelledWord ? [{ id: "sep", label: "" }] : []),
				{ id: "insp", label: "Inspect" },
			];

			if (process.platform === "win32") {
				// Windows custom menu -> call acts[id] on select
				openWinContextMenu(items as any, (id) => acts[id]?.());

				// Listen once for selection and run the action for THIS wc
				ipcMain.once("contextmenu:select", (_ev, id: string) => acts[id]?.());
			} else {
				// Native menu path
				const template = items
					.filter((i) => i.id !== "sep")
					.map((i) => ({
						label: i.label,
						enabled: i.enabled !== false,
						click: () => acts[i.id]?.(),
					})) as Electron.MenuItemConstructorOptions[];
				Menu.buildFromTemplate(template).popup({ window: this.win });
			}
		});

		wc.on("will-navigate", (e, target) => {
			if (!isAllowed(target)) {
				e.preventDefault();
				shell.openExternal(target);
			}
		});
		wc.on("will-redirect", (e, target) => {
			if (!isAllowed(target)) {
				e.preventDefault();
				shell.openExternal(target);
			}
		});
		wc.setWindowOpenHandler(({ url }) => {
			if (isAllowed(url)) this.newTab(url);
			else shell.openExternal(url);
			return { action: "deny" };
		});

		const updateUrl = (navUrl: string) => {
			const t = this.tabs.get(id);
			if (t) t.url = navUrl;
			this.emitState();
		};
		wc.on("did-navigate", (_e, navUrl) => updateUrl(navUrl));
		wc.on("did-navigate-in-page", (_e, navUrl) => updateUrl(navUrl)); // SPA/hash changes

		wc.on("page-title-updated", (_e, title) => {
			const t = this.tabs.get(id);
			if (t) t.title = title;
			this.emitState();
		});
		wc.on("page-favicon-updated", (_e, favs) => {
			const t = this.tabs.get(id);
			if (t && favs.length > 0) t.favicon = favs[0];
			this.emitState();
		});

		if (awaitLoad) {
			await wc.loadURL(url);
		} else {
			wc.loadURL(url);
		}

		if (activate) this.activate(id);
		return id;
	}

	activate(id: number) {
		if (this.activeId === id) return; // already active

		const tab = this.tabs.get(id);
		if (!tab) return;

		// Swap active view via contentView
		if (this.activeId !== null) {
			const active = this.tabs.get(this.activeId);
			if (active) this.win.contentView.removeChildView(active.view);
		}
		this.win.contentView.addChildView(tab.view);
		this.activeId = id;
		this.layoutActiveView();
		this.emitState();
	}

	close(id: number) {
		const tab = this.tabs.get(id);
		if (!tab) return;

		if (this.activeId === id) {
			this.win.contentView.removeChildView(tab.view);
			this.activeId = null;
		}

		// Best-effort cleanup without relying on undocumented typings
		try {
			(tab.view.webContents as any).destroy?.();
		} catch {}

		this.tabs.delete(id);
		this.order = this.order.filter((x) => x !== id); // <-- remove

		if (this.order.length > 0) this.activate(this.order[0]); // <-- next by order

		//if (this.tabs.size > 0) this.activate(Array.from(this.tabs.keys())[0]);
		this.emitState();
	}

	navigate(action: "back" | "forward" | "reload") {
		if (this.activeId === null) return;
		const wc = this.tabs.get(this.activeId)!.view.webContents;
		if (action === "back" && wc.canGoBack()) wc.goBack();
		if (action === "forward" && wc.canGoForward()) wc.goForward();
		if (action === "reload") wc.reload();
	}

	emitState() {
		const s = this.list();
		this.win.webContents.send("tabs:state", s);
		this.onState?.(s, this.activeId);
	}

	public pushState() {
		this.emitState();
	}

	// expose a relayout so main can call it on ready-to-show
	public relayout() {
		this.layoutActiveView();
	}

	public load(url: string) {
		if (this.activeId === null) return;
		const wc = this.tabs.get(this.activeId)!.view.webContents;
		if (isAllowed(url)) wc.loadURL(url);
		else shell.openExternal(url);
	}

	public reorder(newOrder: number[]) {
		const ids = new Set(this.tabs.keys());
		if (newOrder.length !== this.tabs.size) return;
		if (newOrder.some((id) => !ids.has(id))) return;
		this.order = newOrder.slice();
		this.emitState();
	}
}
