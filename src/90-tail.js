		//#region bootstrap
		function installStyles() {
			try {
				if (typeof document === "undefined") return;
				const selector = 'style[data-plugin-css="' + CSS_TAG_ID + '"]';
				if (document.querySelector(selector) !== null) return;
				const style = document.createElement("style");
				style.dataset.plugin = PLUGIN_NAME;
				style.dataset.pluginCss = CSS_TAG_ID;
				style.textContent = CSS;
				document.head.appendChild(style);
			} catch (error) {
				// Styles are cosmetic; a failure here must never break the shell.
			}
		}

		installStyles();

		const inject = ["slots"];

		function apply(ctx) {
			ctx.effect(
				() =>
					ctx.slots.inject("sidebar.panellist", () =>
						ctx.slots.register(
							{ name: "sidebar.panellist", id: PANEL_ID, order: 32, label: PLUGIN_LABEL },
							SciPlotIcon
						)
					),
				"sci-plot: sidebar entry"
			);
			ctx.effect(
				() => ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, SciPlotApp)),
				"sci-plot: main panel"
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.SciPlotApp = SciPlotApp;
		exports.PANEL_ID = PANEL_ID;
		//#endregion

		return module.exports;
	}
});
