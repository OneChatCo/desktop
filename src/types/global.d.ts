export {};
declare global {
	interface Window {
		onechat: {
			tabs: {
				list: () => Promise<any[]>;
				new: (url?: string) => Promise<any[]>;
				activate: (id: number) => Promise<void>;
				close: (id: number) => Promise<void>;
				onAnimateClose: (cb: (id: number) => void) => void;
				navigate: (action: "back" | "forward" | "reload") => Promise<void>;
				load: (url: string) => Promise<void>;
				reorder: (ids: number[]) => Promise<void>;
				requestClose: (id: number) => Promise<void>;
				confirmClose: (id: number) => void;
				onWillClose: (cb: (id: number) => void) => void;
				onState: (cb: (state: any[]) => void) => void;
			};
			menu: {
				newTabPicker: (payload?: {
					anchor: { x: number; y: number };
					scroll?: { x: number; y: number };
				}) => Promise<void>;
			};
			discord: {
				isConnected: () => Promise<boolean>;
				disconnect: () => Promise<void>;
				reconnect: () => Promise<boolean>;
			};
			ready: () => void;
		};
	}
}
