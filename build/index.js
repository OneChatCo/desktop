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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const discord_rpc_1 = require("discord-rpc");
const path_1 = __importDefault(require("path"));
let window = null;
let client = null;
let startTimestamp = new Date();
let discordRetryDuration = 15;
// Discord related
const connectToDiscord = () => {
    if (client) {
        client.destroy();
    }
    client = new discord_rpc_1.Client({
        transport: "ipc",
    });
    client.on("ready", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        console.log(`Successfully authorised as ${(_a = client === null || client === void 0 ? void 0 : client.user) === null || _a === void 0 ? void 0 : _a.username}#${(_b = client === null || client === void 0 ? void 0 : client.user) === null || _b === void 0 ? void 0 : _b.discriminator}`);
        onStartup();
    }));
    client.once("close", () => {
        console.error(`Connection to Discord closed. Attempting to reconnect...`);
        console.log(`Automatically retrying to connect, please wait ${discordRetryDuration} seconds...`);
        connectToDiscord();
    });
    setTimeout(() => {
        client === null || client === void 0 ? void 0 : client.login({ clientId: "991596821455585352" });
    }, discordRetryDuration * 1000);
};
const updatePresence = () => {
    var _a, _b;
    console.log(`Successfully updated ${(_a = client === null || client === void 0 ? void 0 : client.user) === null || _a === void 0 ? void 0 : _a.username}#${(_b = client === null || client === void 0 ? void 0 : client.user) === null || _b === void 0 ? void 0 : _b.discriminator}'s Rich Presence!`);
    return client === null || client === void 0 ? void 0 : client.setActivity({
        details: "Managing my community",
        largeImageKey: "onechat",
        largeImageText: "app.one-chat.co",
        buttons: [
            {
                label: "Secure your community!",
                url: "https://one-chat.co",
            },
        ],
        startTimestamp: startTimestamp,
        instance: true,
    });
};
let initialTasks = [updatePresence], i = 0;
const onStartup = () => {
    initialTasks[i++]();
    if (i < initialTasks.length) {
        setTimeout(onStartup, 5 * 1000); // 5 seconds
    }
};
// Electron related
const createWindow = () => {
    const electronScreen = electron_1.screen;
    const size = electronScreen.getPrimaryDisplay().workAreaSize;
    window = new electron_1.BrowserWindow({
        center: true,
        width: (size.width / 3) * 2,
        height: (size.height / 3) * 2,
        title: "One Chat",
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#303030",
            symbolColor: "#FFFFFF",
            height: 49,
        },
        icon: path_1.default.join(__dirname, "../favicon.ico"),
        show: false,
    });
    console.log(path_1.default.join(__dirname, "favicon.ico"));
    // production
    //window.loadURL("https://app.one-chat.co/");
    // dev
    window.loadURL("http://local.one-chat.co/");
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes("one-chat.co")) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    center: true,
                    width: (size.width / 3) * 2,
                    height: (size.height / 3) * 2,
                    titleBarStyle: "hidden",
                    titleBarOverlay: {
                        color: "#303030",
                        symbolColor: "#FFFFFF",
                        height: 49,
                    },
                    icon: path_1.default.join(__dirname, "../favicon.ico"),
                },
            };
        }
        else {
            electron_1.shell.openExternal(url);
            return { action: "deny" };
        }
    });
    window.webContents.on("did-finish-load", () => {
        window === null || window === void 0 ? void 0 : window.show();
    });
    window.on("closed", () => {
        window = null;
    });
    return window;
};
// Check for application updates
const checkUpdates = () => {
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    electron_updater_1.autoUpdater.on("checking-for-update", () => {
        console.log("Checking for update...");
    });
    electron_updater_1.autoUpdater.on("update-available", (info) => {
        console.log("Update available.");
    });
    electron_updater_1.autoUpdater.on("update-not-available", (info) => {
        console.log("Update not available.");
    });
    electron_updater_1.autoUpdater.on("error", (err) => {
        console.log("Error in auto-updater. " + err);
    });
    electron_updater_1.autoUpdater.on("download-progress", (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + " - Downloaded " + progressObj.percent + "%";
        log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";
        window === null || window === void 0 ? void 0 : window.setProgressBar(progressObj.percent / 100);
        console.log(log_message);
    });
    electron_updater_1.autoUpdater.on("update-downloaded", (ev) => {
        console.log("Update downloaded");
        setTimeout(function () {
            electron_updater_1.autoUpdater.quitAndInstall();
        }, 5000);
    });
};
try {
    electron_1.app.on("ready", () => {
        checkUpdates();
        setTimeout(createWindow, 400);
        connectToDiscord();
    });
    electron_1.app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            electron_1.app.quit();
        }
    });
    electron_1.app.on("activate", () => {
        if (window === null) {
            createWindow();
        }
    });
    process.on("unhandledRejection", (err) => {
        if (err.message === "Could not connect") {
            console.log(`Unable to connect to Discord. Is Discord running and logged-in in the background?`);
            console.log(`Automatically retrying to connect, please wait ${discordRetryDuration} seconds...`);
            connectToDiscord();
        }
    });
}
catch (e) {
    throw e;
}
