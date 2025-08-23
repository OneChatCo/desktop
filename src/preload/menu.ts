import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ctxmenu", {
	onData: (cb: (p: { ticket: number; items: { id: string; label: string; enabled?: boolean }[] }) => void) =>
		ipcRenderer.on("contextmenu:data", (_e, p) => cb(p)),
	measured: (t: number, h: number) => ipcRenderer.send("contextmenu:measured", t, h),
	onGo: (cb: (t: number) => void) => ipcRenderer.on("contextmenu:go", (_e, t) => cb(t)),
	select: (t: number, id: string) => ipcRenderer.send("contextmenu:select", t, id), // ← important
	close: () => ipcRenderer.send("contextmenu:close"),
});
