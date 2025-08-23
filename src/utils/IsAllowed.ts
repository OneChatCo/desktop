export const DEFAULT_HOME = "https://app.one-chat.co";
export const ALLOWED_HOSTS = ["one-chat.co", "onech.at", "telegram.org"];

export const isAllowed = (urlStr: string) => {
	try {
		const u = new URL(urlStr);
		if (u.protocol !== "https:") return false; // tighten if you want http too
		const host = u.hostname.toLowerCase();
		return ALLOWED_HOSTS.some((base) => host === base || host.endsWith("." + base));
	} catch {
		return false;
	}
};
