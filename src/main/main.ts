import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from "electron";
import path from "node:path";

import { TabManager } from "./tabManager";
import { initAutoUpdater } from "./updater";
import { initWinContextMenu, openWinContextMenu } from "./winContextMenu";
import { loadSnapshot, scheduleSave, flushSaves } from "./sessionStore";
import { DiscordRPCManager } from "./discordRpc";

let mainWindow: BrowserWindow;
let tabs: TabManager;
let discordRPC: DiscordRPCManager;

function createWindow() {
	const HEADER_HEIGHT = 52;

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		title: "One Chat",
		icon: path.join(__dirname, "../renderer/icon.png"),
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#121212" : "#ffffff",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
		// Overlay works on Win + macOS; Linux falls back to "hidden"
		titleBarOverlay:
			process.platform !== "linux" ? { color: "#0a0d14", symbolColor: "#ffffff", height: HEADER_HEIGHT } : undefined,
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
		},
		minWidth: 455,
		minHeight: 93 + 125,
	});

	// Minimal app menu (so standard shortcuts work)
	const template: Electron.MenuItemConstructorOptions[] = [
		{
			label: "File",
			submenu: [
				{ label: "New Tab", accelerator: "CmdOrCtrl+T", click: () => tabs.newTab() },
				{ label: "Close Tab", accelerator: "CmdOrCtrl+W", click: () => activeClose() },
				{ type: "separator" },
				{ role: "quit" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ role: "togglefullscreen" },
			],
		},
		{ role: "editMenu" },
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));

	mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
	//mainWindow.webContents.openDevTools();

	tabs = new TabManager(mainWindow);

	// Initialize Discord RPC
	discordRPC = new DiscordRPCManager(mainWindow);
	discordRPC.initialize().catch((err) => {
		console.log("Failed to initialize Discord RPC:", err);
	});

	// just above tabs.onState:
	let restoring = false;

	tabs.onState = (state, activeId) => {
		if (restoring) return; // don't spam saves while restoring
		const idx = state.findIndex((t) => t.id === activeId);
		scheduleSave(
			state.map((t) => ({ url: t.url })),
			idx < 0 ? 0 : idx
		);

		// Update Discord RPC with current tab state
		if (discordRPC) {
			const tabsForRPC = state.map((tab) => ({
				url: tab.url,
				title: tab.title,
				isActive: tab.id === activeId,
			}));
			discordRPC.updateActivity(tabsForRPC);
		}
	};

	(async () => {
		const snap = await loadSnapshot();
		if (snap && snap.tabs.length) {
			restoring = true;

			// create all tabs concurrently, no activate, no awaitLoad
			const ids = await Promise.all(snap.tabs.map((url) => tabs.newTab(url, { activate: false, awaitLoad: false })));

			// activate the saved one once
			const toActivate = ids[snap.activeIndex] ?? ids[0];
			if (toActivate) tabs.activate(toActivate);

			tabs.pushState();

			// single snapshot save after restore
			const state = tabs.list();
			const idx = state.findIndex((t) => t.isActive);
			scheduleSave(
				state.map((t) => ({ url: t.url })),
				idx < 0 ? 0 : idx
			);

			restoring = false;
		} else {
			await tabs.newTab();
			tabs.pushState();
		}
	})();

	mainWindow.on("ready-to-show", () => tabs.relayout?.());

	// IPC
	ipcMain.handle("tabs:list", () => tabs.list());
	ipcMain.handle("tabs:new", async (_e, url?: string) => {
		await tabs.newTab(url);
		return tabs.list();
	});
	ipcMain.handle(
		"menu:newtab",
		async (e, payload?: { anchor: { x: number; y: number }; scroll?: { x: number; y: number } }) => {
			const items = [
				{ id: "n-home", label: "One Chat Dashboard" },
				{ id: "n-revolt", label: "Revolt" },
				{ id: "n-telegram", label: "Telegram Web" },
			];

			// ---- anchor conversion
			let anchorScreen: { x: number; y: number } | undefined;
			if (payload?.anchor) {
				const win = BrowserWindow.fromWebContents(e.sender)!;
				const cb = win.getContentBounds(); // screen DIP origin of content
				const zoom = e.sender.getZoomFactor?.() ?? 1;
				const cssX = payload.anchor.x + (payload.scroll?.x ?? 0);
				const cssY = payload.anchor.y + (payload.scroll?.y ?? 0);
				anchorScreen = { x: cb.x + Math.round(cssX * zoom), y: cb.y + Math.round(cssY * zoom) };
			}

			openWinContextMenu(
				items,
				async (id) => {
					switch (id) {
						case "n-home":
							await tabs.newTab("https://app.one-chat.co");
							break;
						case "n-revolt":
							await tabs.newTab("https://revolt.onech.at");
							break;
						case "n-telegram":
							await tabs.newTab("https://web.telegram.org");
							break;
					}
					tabs.pushState();
				},
				{ anchor: anchorScreen }
			);
		}
	);

	ipcMain.handle("tabs:activate", (_e, id: number) => tabs.activate(id));
	ipcMain.handle("tabs:close", (_e, id: number) => tabs.close(id));
	ipcMain.handle("tabs:request-close", (_e, id: number) => {
		// tell renderer to animate out
		mainWindow.webContents.send("tabs:will-close", id);
		// safety timeout: if renderer doesn't confirm, close anyway
		setTimeout(() => {
			// if it's still present, close it
			const stillThere = tabs.list().some((t) => t.id === id);
			if (stillThere) tabs.close(id);
		}, 300);
	});

	ipcMain.on("tabs:confirm-close", (_e, id: number) => {
		tabs.close(id); // actual close after animation
	});
	ipcMain.handle("tabs:navigate", (_e, a: "back" | "forward" | "reload") => tabs.navigate(a));
	ipcMain.handle("tabs:load", (_e, url: string) => tabs.load(url)); // address bar load
	ipcMain.handle("tabs:reorder", (_e, order: number[]) => {
		tabs.reorder(order);
	});

	ipcMain.on("renderer:ready", () => tabs.pushState()); // ensure first paint

	// Discord RPC IPC handlers
	ipcMain.handle("discord-rpc:is-connected", () => discordRPC?.isRpcConnected() || false);
	ipcMain.handle("discord-rpc:disconnect", async () => {
		if (discordRPC) {
			await discordRPC.disconnect();
		}
	});
	ipcMain.handle("discord-rpc:reconnect", async () => {
		if (discordRPC) {
			return await discordRPC.initialize();
		}
		return false;
	});

	function activeClose() {
		const state = tabs.list();
		const active = state.find((t) => t.isActive);
		if (active) {
			// tell renderer to animate; renderer will call tabs.close(id) afterwards
			mainWindow.webContents.send("tabs:animate-close", active.id);
		}
	}

	initWinContextMenu(mainWindow);

	return mainWindow;
}

app.whenReady().then(() => {
	const win = createWindow();
	initAutoUpdater(win);

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (e) => {
	e.preventDefault();
	try {
		await flushSaves();
		// Disconnect Discord RPC
		if (discordRPC) {
			await discordRPC.disconnect();
		}
	} finally {
		app.exit(0);
	}
});
