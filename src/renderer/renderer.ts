const APP_ORIGIN = "https://app.one-chat.co";

const tabsEl = document.getElementById("tabs") as HTMLDivElement;
const newTabEl = document.getElementById("newTab") as HTMLDivElement;
const backEl = document.getElementById("back") as HTMLButtonElement;
const fwdEl = document.getElementById("forward") as HTMLButtonElement;
const reloadEl = document.getElementById("reload") as HTMLButtonElement;
const address = document.getElementById("address") as HTMLInputElement;

const tabEls = new Map<number, HTMLDivElement>();

let reorderBooted = false;
let isReordering = false;
let queuedState: any[] | null = null;

function animateThenClose(id: number) {
	const el = tabEls.get(id);
	if (!el || el.dataset.exiting === "1") return;
	el.dataset.exiting = "1";

	// Ensure the element is in DOM and visible before animating
	if (!el.isConnected) return;

	// Add the class and force a reflow so the keyframe actually starts
	el.classList.add("tab--exit");
	// force layout (reflow) so the animation isn't coalesced away
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	el.offsetWidth;

	let done = false;
	const finish = () => {
		if (done) return;
		done = true;
		window.onechat.tabs.close(id); // main will emit new state; render() will remove the node
	};

	// If animation runs, close on end
	el.addEventListener("animationend", finish, { once: true });
	// Fallback in case OS has reduced motion or animation was interrupted
	setTimeout(finish, 240);
}

function makeTabElement(t: any) {
	const el = document.createElement("div");
	el.className = "tab" + (t.isActive ? " active" : "");
	el.dataset.id = String(t.id);
	el.setAttribute("draggable", "true");
	el.title = t.url;

	const fav = document.createElement("div");
	fav.className = "fav";
	el.appendChild(fav);

	const title = document.createElement("div");
	title.className = "title";
	const tt = document.createElement("span");
	tt.className = "tt";
	tt.textContent = t.title || "New Tab";
	title.appendChild(tt);
	el.appendChild(title);

	const close = document.createElement("div");
	close.className = "close";
	close.textContent = "×";
	close.addEventListener("click", (e) => {
		if (el.dataset.exiting === "1") return; // don't double-close while animating
		e.stopPropagation();
		animateThenClose(t.id);
	});
	el.appendChild(close);

	el.addEventListener("click", () => {
		if (el.dataset.exiting === "1") return;
		window.onechat.tabs.activate(t.id);
	});
	el.addEventListener("auxclick", (e) => {
		if (e.button !== 1) return;
		if (el.dataset.exiting === "1") return;
		if (e.button === 1) animateThenClose(t.id);
	});

	return el as HTMLDivElement;
}

window.onechat.tabs.onWillClose((id) => {
	kickExit(id);
});

function kickEnter(el: HTMLDivElement) {
	el.classList.add("tab--enter");
	el.addEventListener("animationend", function onEnd() {
		el.classList.remove("tab--enter");
		el.removeEventListener("animationend", onEnd);
	});
}

function kickExit(id: number) {
	const el = tabEls.get(id);
	if (!el || el.dataset.exiting === "1") return;
	el.dataset.exiting = "1";
	el.classList.add("tab--exit");
	el.addEventListener("animationend", function onEnd() {
		el.removeEventListener("animationend", onEnd);
		// tell main it's safe to close now
		window.onechat.tabs.confirmClose(id);
		// we DON'T remove here; main will emit new state removing it
	});
}

// Ensure child order matches state without wiping the rail
function syncOrder(desired: HTMLDivElement[]) {
	// Insert/move nodes into correct order
	desired.forEach((node, i) => {
		const current = tabsEl.children[i];
		if (current !== node) tabsEl.insertBefore(node, current || null);
	});
}

function render(state: any[]) {
	const active = state.find((x) => x.isActive);
	if (active && address) address.value = active.url || "";

	const desired: HTMLDivElement[] = [];

	state.forEach((t) => {
		let el = tabEls.get(t.id);
		if (!el) {
			el = makeTabElement(t);
			tabEls.set(t.id, el);
			tabsEl.appendChild(el);
			// optional enter anim
			el.classList.add("tab--enter");
			el.addEventListener("animationend", () => el?.classList.remove("tab--enter"), { once: true });
		}

		// ⬇️ THE GUARD — skip updating/reordering while exiting
		if (el.dataset.exiting === "1") return; // (use `continue;` if you have a for...of loop)

		// normal updates
		el.classList.toggle("active", !!t.isActive);
		const titleEl = el.querySelector(".title") as HTMLDivElement | null;
		if (titleEl) flipTitle(titleEl, t.title || "New Tab");

		// after you toggle .active and update the title...
		const favEl = el.querySelector(".fav") as HTMLDivElement | null;
		if (favEl) {
			let icon = t.favicon || "";
			// make relative URLs absolute against the tab URL (handles "/favicon.ico")
			if (icon && !/^([a-z]+:)?\/\//i.test(icon)) {
				try {
					icon = new URL(icon, t.url).toString();
				} catch {}
			}
			if (icon) {
				if (favEl.dataset.src !== icon) {
					favEl.style.backgroundImage = `url("${icon}")`;
					favEl.dataset.src = icon; // memoize so we only update when it changes
				}
			} else {
				favEl.style.backgroundImage = "";
				favEl.style.backgroundColor = "#ffffff22";
				delete (favEl as any).dataset.src;
			}
		}

		desired.push(el);
	});

	// keep DOM order without recreating nodes
	desired.forEach((node, i) => {
		const cur = tabsEl.children[i];
		if (cur !== node) tabsEl.insertBefore(node, cur || null);
	});

	// remove nodes that disappeared from state (after exit anim closed the tab)
	for (const [id, el] of tabEls) {
		if (!state.some((t) => t.id === id)) {
			el.remove();
			tabEls.delete(id);
		}
	}
}

function normalizeInput(input: string): string {
	const s = input.trim();
	if (!s) return APP_ORIGIN;
	try {
		// absolute URL?
		const u = new URL(s.includes("://") ? s : "https://" + s);
		return u.toString();
	} catch {
		// treat as path within app.one-chat.co
		return "https://app.one-chat.co" + (s.startsWith("/") ? s : "/" + s);
	}
}

function flipTitle(titleEl: HTMLDivElement, nextText: string) {
	const current = titleEl.querySelector(".tt") as HTMLSpanElement | null;
	if (current && current.textContent === nextText) return;

	const incoming = document.createElement("span");
	incoming.className = "tt tt-enter";
	incoming.textContent = nextText;

	if (current) {
		// place incoming UNDER the current one so the old anim is visible on top
		titleEl.insertBefore(incoming, current);

		// animate out the old one, then remove it (with a fallback)
		current.classList.add("tt-leave");
		let cleared = false;
		const cleanup = () => {
			if (cleared) return;
			cleared = true;
			current.remove();
		};
		current.addEventListener("animationend", cleanup, { once: true });
		setTimeout(cleanup, 250); // fallback if animationend doesn't fire
	} else {
		titleEl.appendChild(incoming);
	}

	// clean the 'enter' class after anim
	incoming.addEventListener("animationend", () => incoming.classList.remove("tt-enter"), { once: true });
}

window.onechat.tabs.onState((state) => {
	render(state); // builds chips
	const active = state.find((x) => x.isActive);
	if (active && address) address.value = active.url || "";

	if (!reorderBooted) {
		initTabReorder();
	}
});

window.onechat.tabs.onAnimateClose((id) => animateThenClose(id)); // for Ctrl/Cmd+W, etc.
window.onechat.ready();
window.onechat.tabs.list().then(render);

newTabEl.addEventListener("click", (e) => {
	e.stopPropagation();
	const r = newTabEl.getBoundingClientRect();
	const anchor = { x: Math.round(r.right), y: Math.round(r.bottom) }; // bottom-right
	const scroll = { x: window.scrollX || 0, y: window.scrollY || 0 };
	window.onechat.menu.newTabPicker({ anchor, scroll });
});

address.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		const next = normalizeInput(address.value);
		window.onechat.tabs.load(next);
	}
});

function initTabReorder() {
	if (reorderBooted) return;
	reorderBooted = true;

	const rail = document.getElementById("tabs")!;
	const DRAG_PX = 5; // start dragging only after this horizontal movement

	// Don’t let OS get drops
	window.addEventListener("dragover", (e) => e.preventDefault(), false);
	window.addEventListener("drop", (e) => e.preventDefault(), false);

	// Single delegated pointerdown for all tabs (survives re-renders)
	rail.addEventListener("pointerdown", onPointerDown as any, { passive: false });

	async function onPointerDown(ev: PointerEvent) {
		if (ev.button !== 0) return; // left-click only
		if (isReordering) return; // prevent multiple simultaneous drags

		const chip = (ev.target as HTMLElement).closest(".tab") as HTMLElement | null;
		if (!chip) return;

		ev.preventDefault();

		await window.onechat.tabs.activate(Number(chip.dataset.id)); // bring to front on drag

		// Initial click refs
		const startClientX = ev.clientX;
		let dragging = false;

		// Prepare shared geometry *once* when drag actually starts
		let startIndex = -1,
			curIndex = -1;
		let railBox: DOMRect;
		let tabs: HTMLElement[] = [];
		let boxes: DOMRect[] = [];
		let widths: number[] = [];
		let centers: number[] = [];
		let chipBox: DOMRect;
		let offsetX = 0;
		let raf = 0,
			moving = false;
		let hasMovedSignificantly = false;

		const startDrag = () => {
			isReordering = true; // Set global state

			// capture layout
			railBox = rail.getBoundingClientRect();
			tabs = [...rail.querySelectorAll<HTMLElement>(".tab")];
			boxes = tabs.map((el) => el.getBoundingClientRect());

			// Account for 6px gap between tabs
			const GAP = 6;
			widths = boxes.map((b) => b.width + GAP); // For positioning calculations
			centers = boxes.map((b, i) => b.left + b.width / 2);

			startIndex = tabs.indexOf(chip);
			curIndex = startIndex;
			chipBox = boxes[startIndex];
			offsetX = startClientX - chipBox.left;

			// visual state
			rail.classList.add("reordering"); // disable titlebar drag
			document.body.classList.add("noselect"); // prevent text selection
			chip.classList.add("dragging");
			(ev.target as Element).setPointerCapture?.(ev.pointerId);

			// Setup transitions: disable for dragged tab, enable smooth transitions for others
			requestAnimationFrame(() => {
				tabs.forEach((el, i) => {
					if (i === startIndex) {
						// Dragged tab: no transitions to prevent flickering
						el.style.transition = "none";
					} else {
						// Non-dragged tabs: smooth transitions for real-time animation
						el.style.transition = "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";
					}
				});
			});

			// first frame
			update();
		};

		const computeInsertIndex = (chipLeft: number) => {
			// insertion index based on how many centers (excluding the dragged one) are left of the chip center
			const chipCenter = chipLeft + chipBox.width / 2;
			let insert = 0;
			for (let i = 0; i < centers.length; i++) {
				if (i === startIndex) continue; // ignore dragged tab
				if (chipCenter > centers[i]) insert++;
			}
			// insert is in [0..tabs.length-1] within the array with the dragged item removed
			return insert;
		};

		const update = () => {
			moving = false;

			// Constrain chip left within rail
			const minX = railBox.left;
			const maxX = railBox.right - chipBox.width;
			const curLeft = Math.max(minX, Math.min(maxX, targetLeft));
			const dx = curLeft - chipBox.left;

			// Move dragged chip immediately for smooth tracking
			chip.style.transform = `translateX(${dx}px)`;
			chip.style.zIndex = "10"; // Ensure dragged tab is above others

			// Where would it insert?
			const insert = computeInsertIndex(curLeft);
			const newCurIndex = insert;

			// Update shifts whenever insertion point changes (real-time animation)
			if (newCurIndex !== curIndex) {
				curIndex = newCurIndex;

				// Calculate shifts for all non-dragged tabs
				const transforms = [];
				for (let i = 0; i < tabs.length; i++) {
					if (i === startIndex) continue;

					let shift = 0;
					// When moving right: tabs between startIndex+1 and curIndex shift left
					if (curIndex > startIndex && i > startIndex && i <= curIndex) {
						shift = -widths[startIndex]; // Use full width including gap
					}
					// When moving left: tabs between curIndex and startIndex-1 shift right
					else if (curIndex < startIndex && i >= curIndex && i < startIndex) {
						shift = widths[startIndex]; // Use full width including gap
					}

					transforms[i] = shift;
				}

				// Apply transforms - non-dragged tabs will animate smoothly due to CSS transitions
				for (let i = 0; i < tabs.length; i++) {
					if (i === startIndex || tabs[i] === chip) continue; // Double check: skip dragged tab
					tabs[i].style.transform = transforms[i] ? `translateX(${transforms[i]}px)` : "";
				}

				hasMovedSignificantly = true;
			}
		};

		let targetLeft = startClientX - chip.getBoundingClientRect().left;

		const onMove = (e: PointerEvent) => {
			// If not yet dragging, check threshold
			if (!dragging) {
				const dx0 = Math.abs(e.clientX - startClientX);
				if (dx0 < DRAG_PX) return; // still a click
				dragging = true;
				startDrag();
			}

			// Update target position relative to rail
			const newTargetLeft = e.clientX - offsetX;

			// Only update if position changed significantly (reduce unnecessary RAF calls and potential flickering)
			if (Math.abs(newTargetLeft - targetLeft) > 2) {
				targetLeft = newTargetLeft;

				if (!moving && dragging) {
					moving = true;
					raf = requestAnimationFrame(update);
				}
			}
		};

		const cleanup = () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			if (dragging) {
				rail.classList.remove("reordering");
				rail.style.pointerEvents = ""; // Reset pointer events
				document.body.classList.remove("noselect");

				// Clear transforms and transitions thoroughly for all tabs
				tabs.forEach((el) => {
					el.style.transform = "";
					el.style.transition = "";
					el.style.zIndex = ""; // Reset z-index
				});

				// Only remove dragging class if it's still there
				if (chip && chip.classList.contains("dragging")) {
					chip.classList.remove("dragging");
					chip.style.transform = "";
					chip.style.transition = "";
					chip.style.zIndex = ""; // Reset z-index
				}

				// Reset dragging state
				dragging = false;
				isReordering = false;
				hasMovedSignificantly = false;
			}
		};

		const onUp = async () => {
			if (!dragging) {
				cleanup();
				return;
			} // treat as simple click

			// Cancel any pending animation frames
			cancelAnimationFrame(raf);

			// Build new order (remove at startIndex, insert at curIndex)
			const ids = [...rail.querySelectorAll<HTMLElement>(".tab")].map((el) => Number(el.dataset.id));
			const [moved] = ids.splice(startIndex, 1);
			ids.splice(curIndex, 0, moved);

			// Remove dragging class
			chip.classList.remove("dragging");

			// Prevent interaction during animation
			rail.style.pointerEvents = "none";

			// FLIP Animation: First - record current VISUAL positions (including transforms)
			const currentVisualPositions = tabs.map((el) => {
				const rect = el.getBoundingClientRect();
				return rect.left;
			});

			// Temporarily apply the new DOM order to measure final positions
			const newOrder = [...tabs];
			const [movedTab] = newOrder.splice(startIndex, 1);
			newOrder.splice(curIndex, 0, movedTab);

			// Clear all transforms temporarily to get natural positions
			tabs.forEach((tab) => {
				tab.style.transform = "";
			});

			// Apply new order to DOM temporarily
			newOrder.forEach((tab) => rail.appendChild(tab));

			// Last - record final natural positions (no transforms)
			const finalPositions = newOrder.map((el) => el.getBoundingClientRect().left);

			// Restore original DOM order temporarily
			tabs.forEach((tab) => rail.appendChild(tab));

			// Invert - calculate transforms needed to make tabs appear in their current visual positions
			const transforms = tabs.map((tab, i) => {
				const newIndex = newOrder.indexOf(tab);
				const targetFinalPosition = finalPositions[newIndex];
				const currentVisualPosition = currentVisualPositions[i];
				const delta = currentVisualPosition - targetFinalPosition;
				return delta;
			});

			// Apply initial transforms (this makes tabs appear in their current positions)
			tabs.forEach((tab, i) => {
				tab.style.transition = "none";
				tab.style.transform = `translateX(${transforms[i]}px)`;
			});

			// Force a reflow to ensure transforms are applied
			rail.offsetHeight;

			// Apply final DOM order
			newOrder.forEach((tab) => rail.appendChild(tab));

			// Play - animate from current positions to final positions (transform: none)
			requestAnimationFrame(() => {
				tabs.forEach((tab) => {
					tab.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
					tab.style.transform = "";
				});

				// Clean up after animation
				setTimeout(() => {
					tabs.forEach((tab) => {
						tab.style.transition = "";
					});

					// Commit to main process
					window.onechat.tabs.reorder(ids).then(() => {
						rail.style.pointerEvents = "";
						cleanup();
					});
				}, 300);
			});
		};

		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerup", onUp, { passive: true });
	}
}

document.addEventListener("DOMContentLoaded", () => {
	initTabReorder(); // safe: it no-ops if already initialized
	window.onechat.ready();
});
