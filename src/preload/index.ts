import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("onechat", {
	tabs: {
		list: () => ipcRenderer.invoke("tabs:list"),
		new: (url?: string) => ipcRenderer.invoke("tabs:new", url),
		activate: (id: number) => ipcRenderer.invoke("tabs:activate", id),
		close: (id: number) => ipcRenderer.invoke("tabs:close", id),
		onAnimateClose: (cb: (id: number) => void) => ipcRenderer.on("tabs:animate-close", (_e, id) => cb(id)),
		navigate: (action: "back" | "forward" | "reload") => ipcRenderer.invoke("tabs:navigate", action),
		load: (url: string) => ipcRenderer.invoke("tabs:load", url),
		reorder: (order: number[]) => ipcRenderer.invoke("tabs:reorder", order),
		requestClose: (id: number) => ipcRenderer.invoke("tabs:request-close", id),
		confirmClose: (id: number) => ipcRenderer.send("tabs:confirm-close", id),
		onWillClose: (cb: (id: number) => void) => ipcRenderer.on("tabs:will-close", (_e, id) => cb(id)),
		onState: (cb: (state: any[]) => void) => ipcRenderer.on("tabs:state", (_e, s) => cb(s)),
	},
	menu: {
		newTabPicker: (payload?: { anchor: { x: number; y: number }; scroll?: { x: number; y: number } }) =>
			ipcRenderer.invoke("menu:newtab", payload),
	},
	discord: {
		isConnected: () => ipcRenderer.invoke("discord-rpc:is-connected"),
		disconnect: () => ipcRenderer.invoke("discord-rpc:disconnect"),
		reconnect: () => ipcRenderer.invoke("discord-rpc:reconnect"),
	},
	ready: () => ipcRenderer.send("renderer:ready"),
});
