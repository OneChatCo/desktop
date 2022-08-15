import { join } from "path";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import { register, Client } from "discord-rpc";

class Application {
	private window!: BrowserWindow;
	private cient_reg: any;
	private client!: Client;
	private startTime: Date;

	constructor() {
		this.startTime = new Date();

		this.cient_reg = register("991596821455585352");
		this.client = new Client({ transport: "ipc" });
	}

	startApp(): void {
		app.whenReady().then(() => {
			this.createWindow();

			app.on("activate", () => {
				if (BrowserWindow.getAllWindows().length === 0) {
					this.createWindow();
				}
			});
		});

		app.on("window-all-closed", () => {
			if (process.platform !== "darwin") {
				app.quit();
			}
		});
	}

	createWindow(): void {
		this.window = new BrowserWindow({
			width: 800,
			height: 600,
			webPreferences: {
				preload: join(__dirname, "js/preload.js"),
			},
			titleBarStyle: "hidden",
			titleBarOverlay: {
				color: "#303030",
				symbolColor: "#FFFFFF",
				height: 50,
			},
		});

		this.window.loadURL("http://local.discgram.us/");

		ipcMain.handle("dark-mode:toggle", () => {
			if (nativeTheme.shouldUseDarkColors) {
				nativeTheme.themeSource = "light";
			} else {
				nativeTheme.themeSource = "dark";
			}

			return nativeTheme.shouldUseDarkColors;
		});

		ipcMain.handle("dark-mode:system", () => {
			nativeTheme.themeSource = "system";
		});
	}

	async setActivity(): Promise<void> {
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
	}
}

(async () => {
	const AppWindow = new Application();

	try {
		AppWindow.startApp();

		await AppWindow.setActivity();

		setInterval(async () => {
			await AppWindow.setActivity();
		}, 15e3);
	} catch (e) {
		console.error(e);
	}
})();
