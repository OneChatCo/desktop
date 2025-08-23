import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";

export function initAutoUpdater(win: BrowserWindow) {
	// Optional: auto-download; prompt on ready
	autoUpdater.autoDownload = true;

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
		console.error("AutoUpdater error:", err);
	});

	// First check on startup
	autoUpdater.checkForUpdatesAndNotify().catch(() => {});

	// Periodic checks (every 6 hours)
	setInterval(() => {
		autoUpdater.checkForUpdatesAndNotify().catch(() => {});
	}, 1000 * 60 * 60 * 6);
}
