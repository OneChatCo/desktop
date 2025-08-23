import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";

export function initAutoUpdater(win: BrowserWindow) {
	autoUpdater.setFeedURL({
		provider: "github",
		owner: "OneChatCo",
		repo: "desktop",
	});

	// Optional: auto-download; prompt on ready
	autoUpdater.autoDownload = true;

	// Optional: Check for pre-release versions
	// autoUpdater.allowPrerelease = false;

	// Optional: Enable logging for debugging
	autoUpdater.logger = console;

	// Add comprehensive event logging
	autoUpdater.on("checking-for-update", () => {
		const msg = "AutoUpdater: Checking for update...";
		console.log(msg);
	});

	autoUpdater.on("update-available", (info) => {
		const msg = `AutoUpdater: Update available: ${JSON.stringify(info)}`;
		console.log(msg);
	});

	autoUpdater.on("update-not-available", (info) => {
		const msg = `AutoUpdater: Update not available: ${JSON.stringify(info)}`;
		console.log(msg);
	});

	autoUpdater.on("download-progress", (progress) => {
		// Show download progress under taskbar icon
		win.setProgressBar(progress.percent / 100);

		// Optionally handle download progress
		console.log(`Download progress: ${progress.percent}%`);
	});

	autoUpdater.on("update-downloaded", async () => {
		const res = await dialog.showMessageBox({
			type: "info",
			buttons: ["Restart Now", "Later"],
			defaultId: 0,
			title: "Update ready",
			message: "A new version of One Chat has been downloaded.",
			detail: "Restart to apply the update.",
		});
		if (res.response === 0) {
			autoUpdater.quitAndInstall();
		}
	});

	autoUpdater.on("error", (err) => {
		// Non-fatal; just log
		const msg = `AutoUpdater error: ${err.message}`;
		console.error(msg);
	});

	// First check on startup
	console.log("AutoUpdater: Starting initial update check...");
	autoUpdater.checkForUpdatesAndNotify().catch((err) => {
		console.log(`AutoUpdater: Initial check failed: ${err.message}`);
	});

	// Periodic checks (every 6 hours)
	setInterval(() => {
		autoUpdater.checkForUpdatesAndNotify().catch(() => {});
	}, 1000 * 60 * 60 * 6);
}
