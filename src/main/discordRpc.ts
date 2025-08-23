import { Client } from "discord-rpc";
import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";

interface DiscordActivity {
	details?: string;
	state?: string;
	startTimestamp?: number;
	endTimestamp?: number;
	largeImageKey?: string;
	largeImageText?: string;
	smallImageKey?: string;
	smallImageText?: string;
	partyId?: string;
	partySize?: number;
	partyMax?: number;
	matchSecret?: string;
	joinSecret?: string;
	spectateSecret?: string;
	instance?: boolean;
	buttons?: Array<{
		label: string;
		url: string;
	}>;
}

interface TabInfo {
	url: string;
	title?: string;
	isActive: boolean;
}

export class DiscordRPCManager {
	private client: Client | null = null;
	private isConnected = false;
	private clientId = "YOUR_DISCORD_APP_CLIENT_ID"; // Default fallback
	private startTimestamp = Date.now();
	private currentActivity: DiscordActivity | null = null;
	private mainWindow: BrowserWindow | null = null;

	constructor(mainWindow?: BrowserWindow) {
		this.mainWindow = mainWindow || null;
		this.loadConfig();
	}

	/**
	 * Load configuration from config.json
	 */
	private loadConfig(): void {
		try {
			const configPath = path.join(process.cwd(), "config.json");
			if (fs.existsSync(configPath)) {
				const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
				if (config.discord?.clientId) {
					this.clientId = config.discord.clientId;
				}
			}
		} catch (error) {
			console.log("Discord RPC: Failed to load config:", error);
		}
	}

	/**
	 * Initialize Discord RPC connection
	 */
	async initialize(): Promise<boolean> {
		try {
			// Only initialize if we have a valid client ID
			if (this.clientId === "YOUR_DISCORD_APP_CLIENT_ID") {
				console.log("Discord RPC: Client ID not configured, skipping initialization");
				return false;
			}

			this.client = new Client({ transport: "ipc" });

			this.client.on("ready", () => {
				console.log("Discord RPC: Connected to Discord");
				this.isConnected = true;
				this.setDefaultActivity();
			});

			this.client.on("disconnected", () => {
				console.log("Discord RPC: Disconnected from Discord");
				this.isConnected = false;
			});

			await this.client.login({ clientId: this.clientId });
			return true;
		} catch (error) {
			console.log("Discord RPC: Failed to connect:", error);
			return false;
		}
	}

	/**
	 * Set default activity when no specific tab is active
	 */
	private setDefaultActivity(): void {
		const activity: DiscordActivity = {
			details: "Using One Chat",
			state: "Managing conversations",
			startTimestamp: this.startTimestamp,
			largeImageKey: "onechat2",
			largeImageText: "One Chat Desktop",
			buttons: [
				{
					label: "Secure your business!",
					url: "https://onech.at",
				},
			],
		};

		this.setActivity(activity);
	}

	/**
	 * Update activity based on current tab
	 */
	updateActivity(tabs: TabInfo[]): void {
		if (!this.isConnected || !this.client) return;

		const activeTab = tabs.find((tab) => tab.isActive);
		if (!activeTab) {
			this.setDefaultActivity();
			return;
		}

		const activity = this.getActivityForUrl(activeTab.url, activeTab.title);
		this.setActivity(activity);
	}

	/**
	 * Get Discord activity based on URL
	 */
	private getActivityForUrl(url: string, title?: string): DiscordActivity {
		const domain = this.extractDomain(url);

		// Base activity
		const activity: DiscordActivity = {
			startTimestamp: this.startTimestamp,
			largeImageKey: "onechat2",
			largeImageText: "One Chat Desktop",
		};

		// Customize based on the service
		switch (domain) {
			case "app.one-chat.co":
				activity.details = "One Chat Dashboard";
				activity.state = "Managing conversations";
				activity.smallImageKey = "onechat-small";
				activity.smallImageText = "One Chat";
				break;

			case "revolt.onech.at":
			case "app.revolt.chat":
				activity.details = "Using Revolt";
				activity.state = title || "Chatting";
				activity.smallImageKey = "revolt";
				activity.smallImageText = "Revolt";
				break;

			case "web.telegram.org":
			case "telegram.org":
				activity.details = "Using Telegram Web";
				activity.state = title || "Messaging";
				activity.smallImageKey = "telegram";
				activity.smallImageText = "Telegram";
				break;

			default:
				activity.details = "Browsing";
				activity.state = "all over the web";
				if (title) {
					activity.details = title.length > 50 ? title.substring(0, 47) + "..." : title;
				}
				break;
		}

		// Add buttons
		activity.buttons = [
			{
				label: "Download One Chat",
				url: "https://onech.at",
			},
		];

		return activity;
	}

	/**
	 * Extract domain from URL
	 */
	private extractDomain(url: string): string {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.replace(/^www\./, "");
		} catch {
			return "";
		}
	}

	/**
	 * Set Discord activity
	 */
	private async setActivity(activity: DiscordActivity): Promise<void> {
		if (!this.isConnected || !this.client) return;

		try {
			// Don't update if the activity hasn't changed (to avoid rate limiting)
			if (JSON.stringify(this.currentActivity) === JSON.stringify(activity)) {
				return;
			}

			await this.client.setActivity(activity);
			this.currentActivity = activity;
		} catch (error) {
			console.log("Discord RPC: Failed to set activity:", error);
		}
	}

	/**
	 * Clear current activity
	 */
	async clearActivity(): Promise<void> {
		if (!this.isConnected || !this.client) return;

		try {
			await this.client.clearActivity();
			this.currentActivity = null;
		} catch (error) {
			console.log("Discord RPC: Failed to clear activity:", error);
		}
	}

	/**
	 * Disconnect from Discord RPC
	 */
	async disconnect(): Promise<void> {
		if (this.client && this.isConnected) {
			try {
				await this.clearActivity();
				this.client.destroy();
				this.isConnected = false;
				console.log("Discord RPC: Disconnected");
			} catch (error) {
				console.log("Discord RPC: Error during disconnect:", error);
			}
		}
	}

	/**
	 * Check if connected
	 */
	isRpcConnected(): boolean {
		return this.isConnected;
	}

	/**
	 * Set client ID (useful for configuration)
	 */
	setClientId(clientId: string): void {
		this.clientId = clientId;
	}
}
