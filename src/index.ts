import { MicaBrowserWindow, Theme, Mica, isWindows11 } from "mica-electron-ts";
import { app, screen, shell } from "electron";
import { autoUpdater, UpdateDownloadedEvent } from "electron-updater";
import { Client } from "discord-rpc";
import path from "path";

let window: MicaBrowserWindow | null = null;
let client: Client | null = null;
let startTimestamp: Date = new Date();
let discordRetryDuration: number = 15;

// Discord related
const connectToDiscord = (): any => {
	if (client) {
		client.destroy();
	}

	client = new Client({
		transport: "ipc",
	});

	client.on("ready", async () => {
		console.log(`Successfully authorised as ${client?.user?.username}#${client?.user?.discriminator}`);
		onStartup();
	});

	client.once("close", () => {
		console.error(`Connection to Discord closed. Attempting to reconnect...`);
		console.log(`Automatically retrying to connect, please wait ${discordRetryDuration} seconds...`);
		connectToDiscord();
	});

	setTimeout(() => {
		client?.login({ clientId: "991596821455585352" });
	}, discordRetryDuration * 1000);
};

const updatePresence = (): any => {
	console.log(`Successfully updated ${client?.user?.username}#${client?.user?.discriminator}'s Rich Presence!`);

	return client?.setActivity({
		details: "Managing my business",
		largeImageKey: "onechat",
		largeImageText: "app.one-chat.co",
		buttons: [
			{
				label: "Secure your business!",
				url: "https://one-chat.co",
			},
		],
		startTimestamp: startTimestamp,
		instance: true,
	});
};

let initialTasks = [updatePresence],
	i = 0;

const onStartup = () => {
	initialTasks[i++]();
	if (i < initialTasks.length) {
		setTimeout(onStartup, 5 * 1000); // 5 seconds
	}
};

// Electron related
const createWindow = (): MicaBrowserWindow => {
	const electronScreen = screen;
	const size = electronScreen.getPrimaryDisplay().workAreaSize;

	window = new MicaBrowserWindow({
		center: true,
		width: (size.width / 3) * 2,
		height: (size.height / 3) * 2,
		title: "One Chat",
		autoHideMenuBar: true,
		icon: path.join(__dirname, "../favicon.ico"),
		show: false,
	});

	if (isWindows11) {
		// Set window to use dark theme
		window.setTheme(Theme.Dark);
		// Set window effect to Mica
		window.setMicaEffect(Mica.Normal);
	}

	// production
	window.loadURL("https://app.one-chat.co/");

	// dev
	//window.loadURL("http://local.one-chat.co/");

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
					icon: path.join(__dirname, "../favicon.ico"),
				},
			};
		} else {
			shell.openExternal(url);
			return { action: "deny" };
		}
	});

	window.webContents.on("did-finish-load", () => {
		window?.show();
	});

	window.on("closed", () => {
		window = null;
	});

	return window;
};

// Check for application updates
const checkUpdates = (): void => {
	autoUpdater.checkForUpdatesAndNotify();

	autoUpdater.on("checking-for-update", () => {
		console.log("Checking for update...");
	});
	autoUpdater.on("update-available", (info) => {
		console.log("Update available.");
	});
	autoUpdater.on("update-not-available", (info) => {
		console.log("Update not available.");
	});
	autoUpdater.on("error", (err) => {
		console.log("Error in auto-updater. " + err);
	});
	autoUpdater.on("download-progress", (progressObj) => {
		let log_message = "Download speed: " + progressObj.bytesPerSecond;
		log_message = log_message + " - Downloaded " + progressObj.percent + "%";
		log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";

		window?.setProgressBar(progressObj.percent / 100);

		console.log(log_message);
	});
	autoUpdater.on("update-downloaded", (ev: UpdateDownloadedEvent) => {
		console.log("Update downloaded");

		setTimeout(function () {
			autoUpdater.quitAndInstall();
		}, 5000);
	});
};

try {
	app.on("ready", () => {
		checkUpdates();

		setTimeout(createWindow, 400);
		connectToDiscord();
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("activate", () => {
		if (window === null) {
			createWindow();
		}
	});

	process.on("unhandledRejection", (err: any) => {
		if (err.message === "Could not connect") {
			console.log(`Unable to connect to Discord. Is Discord running and logged-in in the background?`);
			console.log(`Automatically retrying to connect, please wait ${discordRetryDuration} seconds...`);
			connectToDiscord();
		}
	});
} catch (e) {
	throw e;
}
