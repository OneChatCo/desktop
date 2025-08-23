import path from "node:path";
import { BrowserWindow, BrowserWindowConstructorOptions, ipcMain, screen } from "electron";

export type CtxItem = { id: string; label: string; enabled?: boolean };
export type MenuAnchor = { x: number; y: number }; // screen coords
type Options = { anchor?: MenuAnchor };

const WIDTH = 280;
const MAX_H = 800;

let menuWin: BrowserWindow | null = null;
let parentRef: BrowserWindow | null = null;

// Ticket gates each open; selectHandler is your original callback
let currentTicket = 0;
let currentOnSelect: ((id: string) => void) | null = null;
let currentAnchor: MenuAnchor | null = null;

export function initWinContextMenu(parent: BrowserWindow) {
	parentRef = parent;
	if (process.platform !== "win32" || menuWin) return;

	const opts: BrowserWindowConstructorOptions = {
		width: WIDTH,
		height: MAX_H,
		frame: false,
		transparent: true,
		resizable: false,
		movable: false,
		show: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		parent,
		focusable: true,
		hasShadow: false,
		roundedCorners: true,
		useContentSize: true,
		backgroundColor: "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "../preload/menu.js"),
			contextIsolation: true,
			sandbox: true,
			backgroundThrottling: false,
		},
	};

	menuWin = new BrowserWindow(opts);
	try {
		(menuWin as any).setBackgroundMaterial?.("acrylic");
	} catch {}

	menuWin.loadFile(path.join(__dirname, "../renderer/context-menu.html"));

	// Close behavior
	menuWin.on("blur", () => menuWin?.hide());
	parent.on("closed", () => {
		menuWin?.destroy();
		menuWin = null;
		parentRef = null;
	});

	// ---- Single, global IPC listeners ----

	// Renderer measured the DOM height (ticketed)
	ipcMain.on("contextmenu:measured", (_e, ticket: number, rawH: number) => {
		if (!menuWin || ticket !== currentTicket) return;

		const height = Math.min(rawH, MAX_H);
		menuWin.setContentSize(WIDTH, height);

		// Get actual outer width after sizing
		const { width, height: h } = menuWin.getBounds();

		let x: number, y: number;
		if (currentAnchor) {
			// Align RIGHT edge of menu to RIGHT edge of button, just below it
			x = Math.round(currentAnchor.x - width);
			y = Math.round(currentAnchor.y + 6);
		} else {
			const pt = screen.getCursorScreenPoint();
			x = pt.x + 8;
			y = pt.y + 8;
		}

		// Clamp to work area of the nearest display
		const ref = currentAnchor ?? screen.getCursorScreenPoint();
		const wa = screen.getDisplayNearestPoint(ref).workArea;
		if (x + width > wa.x + wa.width) x = wa.x + wa.width - width - 4;
		if (y + h > wa.y + wa.height) y = wa.y + wa.height - h - 4;
		if (x < wa.x) x = wa.x + 4;
		if (y < wa.y) y = wa.y + 4;

		menuWin.setPosition(x, y, false);
		menuWin.webContents.send("contextmenu:go", ticket);
		menuWin.setOpacity(1);
		menuWin.show();
		menuWin.focus();
	});

	// Selection from renderer (ticketed)
	ipcMain.on("contextmenu:select", (_e, ticket: number, id: string) => {
		if (!menuWin || ticket !== currentTicket) return; // ignore stale

		const cb = currentOnSelect;
		currentOnSelect = null;

		hideWinContextMenu();
		if (cb) cb(id);
	});

	ipcMain.on("contextmenu:close", () => hideWinContextMenu());
}

export function openWinContextMenu(items: CtxItem[], onSelect: (id: string) => void, opts?: Options) {
	if (process.platform !== "win32" || !menuWin || !parentRef) return;

	// New ticket; prep state
	currentTicket += 1;
	currentOnSelect = onSelect;
	currentAnchor = opts?.anchor ?? null;

	// Render offscreen, then measure → position → show (handled by measured listener)
	if (menuWin.isVisible()) menuWin.hide();
	menuWin.setOpacity(0);
	menuWin.webContents.send("contextmenu:data", { ticket: currentTicket, items });
}

export function hideWinContextMenu() {
	try {
		if (menuWin?.isVisible()) menuWin.hide();
	} catch {}
}
