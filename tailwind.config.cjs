module.exports = {
	content: ["./src/renderer/**/*.{html,ts}"],
	theme: {
		extend: {
			colors: {
				neon1: "#ff28a7", // fuchsia/magenta
				neon2: "#00f5ff", // cyan
				base: "#0a0d14",
				pane: "#0f1320",
			},
			boxShadow: {
				neon: "0 0 18px rgba(255,40,167,.35), 0 0 28px rgba(0,245,255,.25)",
			},
			keyframes: {
				glow: { "0%,100%": { opacity: 0.85 }, "50%": { opacity: 1 } },
			},
			animation: { glow: "glow 2.2s ease-in-out infinite" },
		},
	},
	plugins: [],
};
