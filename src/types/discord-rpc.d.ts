declare module "discord-rpc" {
	export interface ClientOptions {
		transport?: "ipc" | "websocket";
	}

	export interface LoginOptions {
		clientId: string;
		clientSecret?: string;
		accessToken?: string;
		rpcToken?: string;
		tokenEndpoint?: string;
		scopes?: string[];
	}

	export interface Activity {
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

	export class Client {
		constructor(options?: ClientOptions);
		login(options: LoginOptions): Promise<any>;
		setActivity(activity: Activity): Promise<any>;
		clearActivity(): Promise<any>;
		destroy(): void;
		on(event: "ready" | "disconnected", listener: () => void): void;
	}
}
