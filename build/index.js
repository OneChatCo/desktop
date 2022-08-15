"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const electron_1 = require("electron");
const discord_rpc_1 = require("discord-rpc");
class Application {
    constructor() {
        this.startTime = new Date();
        this.cient_reg = (0, discord_rpc_1.register)("991596821455585352");
        this.client = new discord_rpc_1.Client({ transport: "ipc" });
    }
    startApp() {
        electron_1.app.whenReady().then(() => {
            this.createWindow();
            electron_1.app.on("activate", () => {
                if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
            });
        });
        electron_1.app.on("window-all-closed", () => {
            if (process.platform !== "darwin") {
                electron_1.app.quit();
            }
        });
    }
    createWindow() {
        this.window = new electron_1.BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                preload: (0, path_1.join)(__dirname, "js/preload.js"),
            },
            titleBarStyle: "hidden",
            titleBarOverlay: {
                color: "#303030",
                symbolColor: "#FFFFFF",
                height: 50,
            },
        });
        this.window.loadURL("http://local.discgram.us/");
        electron_1.ipcMain.handle("dark-mode:toggle", () => {
            if (electron_1.nativeTheme.shouldUseDarkColors) {
                electron_1.nativeTheme.themeSource = "light";
            }
            else {
                electron_1.nativeTheme.themeSource = "dark";
            }
            return electron_1.nativeTheme.shouldUseDarkColors;
        });
        electron_1.ipcMain.handle("dark-mode:system", () => {
            electron_1.nativeTheme.themeSource = "system";
        });
    }
    setActivity() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client || !this.window) {
                return;
            }
            this.client.once("ready", () => {
                this.client
                    .setActivity({
                    startTimestamp: this.startTime,
                    largeImageKey: "discgram",
                    largeImageText: "Discgram",
                    details: "Managing my community!",
                })
                    .then(console.log)
                    .catch(console.error);
            });
        });
    }
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    const AppWindow = new Application();
    try {
        AppWindow.startApp();
        yield AppWindow.setActivity();
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            yield AppWindow.setActivity();
        }), 15e3);
    }
    catch (e) {
        console.error(e);
    }
}))();
