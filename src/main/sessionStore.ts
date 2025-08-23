import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import { isAllowed } from "../utils";

const FILE = path.join(app.getPath("userData"), "tabs.session.json");
const MAX_TABS = 30;

type Snapshot = { version: 1; tabs: string[]; activeIndex: number };

let timer: NodeJS.Timeout | null = null;
let pending: Promise<void> | null = null;

export function scheduleSave(state: { url: string }[], activeIndex: number) {
	const data: Snapshot = {
		version: 1,
		tabs: state
			.map((s) => s.url)
			.filter(isAllowed)
			.slice(0, MAX_TABS),
		activeIndex: Math.max(0, Math.min(activeIndex, state.length - 1)),
	};
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		pending = writeAtomic(FILE, JSON.stringify(data));
	}, 120);
}

export async function flushSaves() {
	await pending?.catch(() => {});
}

export async function loadSnapshot(): Promise<Snapshot | null> {
	try {
		const raw = await fs.readFile(FILE, "utf8");
		const json = JSON.parse(raw) as Snapshot;
		if (json?.version === 1 && Array.isArray(json.tabs)) {
			const tabs = json.tabs.filter(isAllowed).slice(0, MAX_TABS);
			const activeIndex = Math.max(0, Math.min(json.activeIndex ?? 0, tabs.length - 1));
			return { version: 1, tabs, activeIndex };
		}
	} catch {
		/* first run / corrupt file */
	}
	return null;
}

async function writeAtomic(file: string, payload: string) {
	const tmp = file + ".tmp";
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(tmp, payload, "utf8");
	await fs.rename(tmp, file);
}
