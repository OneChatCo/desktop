"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("darkMode", {
    toggle: () => electron_1.ipcRenderer.invoke("dark-mode:toggle"),
    system: () => electron_1.ipcRenderer.invoke("dark-mode:system"),
});
