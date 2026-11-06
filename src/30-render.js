		//#region render — geometry
		function plotBox() {
			return {
				left: PAD.left,
				top: PAD.top,
				width: VB.w - PAD.left - PAD.right,
				height: VB.h - PAD.top - PAD.bottom
			};
		}

		/**
		 * One mapping object shared by drawing, hit-testing and export, so a point
		 * drawn at a pixel reads back as the same value under the cursor.
		 */
		function makeScales(view, axis) {
			const box = plotBox();
			const useLog = !!(axis && axis.yLog);
			const logOf = (value) => (useLog ? (value > 0 ? Math.log10(value) : NaN) : value);
			let top = logOf(view.yHi);
			let bottom = logOf(view.yLo);
			if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
				top = Number.isFinite(top) ? top : bottom + 1;
				bottom = Number.isFinite(bottom) ? bottom : top - 1;
			}
			const xSpan = view.xHi - view.xLo || 1;
			const ySpan = top - bottom || 1;
			return {
				box,
				sx: (x) => box.left + ((x - view.xLo) / xSpan) * box.width,
				ix: (px) => view.xLo + ((px - box.left) / box.width) * xSpan,
				sy: (y) => {
					const mapped = logOf(y);
					if (!Number.isFinite(mapped)) return NaN;
					return box.top + box.height - ((mapped - bottom) / ySpan) * box.height;
				},
				iy: (py) => {
					const t = (box.top + box.height - py) / box.height;
					const mapped = bottom + t * ySpan;
					return useLog ? Math.pow(10, mapped) : mapped;
				}
			};
		}

		function visibleList(datasets) {
			return (datasets || []).filter((item) => item.visible !== false);
		}
		//#endregion

		//#region render — svg pieces
		function svgFrame(scales, color) {
			const box = scales.box;
			return h("rect", {
				x: box.left,
				y: box.top,
				width: box.width,
				height: box.height,
				fill: "none",
				stroke: color,
				strokeWidth: 2
			});
		}

		function svgAxisTicks(scales, view, axis, colors) {
			const box = scales.box;
			const xTicks = niceTicks(view.xLo, view.xHi, 6);
			const yTicks = axis.yLog
				? niceTicks(Math.log10(Math.max(view.yLo, 1e-12)), Math.log10(Math.max(view.yHi, 1e-12)), 6)
				: niceTicks(view.yLo, view.yHi, 6);
			const nodes = [];
			const tickLen = 5;
			const minorLen = 3;

			for (const value of xTicks.minor) {
				const px = scales.sx(value);
				if (!Number.isFinite(px) || px < box.left - 1 || px > box.left + box.width + 1) continue;
				nodes.push(h("line", { key: `xm${value}`, x1: px, y1: box.top + box.height, x2: px, y2: box.top + box.height - minorLen, stroke: colors.border, strokeWidth: 1 }));
			}
			for (const value of xTicks.ticks) {
				const px = scales.sx(value);
				if (!Number.isFinite(px) || px < box.left - 1 || px > box.left + box.width + 1) continue;
				nodes.push(h("line", { key: `xt${value}`, x1: px, y1: box.top + box.height, x2: px, y2: box.top + box.height + tickLen, stroke: colors.text, strokeWidth: 1.2 }));
				nodes.push(
					h("text", {
						key: `xl${value}`,
						x: px,
						y: box.top + box.height + tickLen + 15,
						fill: colors.text,
						fontFamily: FONT_PLOT,
						fontSize: 13,
						textAnchor: "middle"
					}, formatTick(value, xTicks.step))
				);
			}

			if (axis.yLog) {
				for (const logValue of yTicks.minor) {
					const py = box.top + box.height - ((logValue - yTicks.lo) / (yTicks.hi - yTicks.lo || 1)) * box.height;
					if (!Number.isFinite(py) || py < box.top - 1 || py > box.top + box.height + 1) continue;
					nodes.push(h("line", { key: `ym${logValue}`, x1: box.left, y1: py, x2: box.left + minorLen, y2: py, stroke: colors.border, strokeWidth: 1 }));
				}
				for (const logValue of yTicks.ticks) {
					const py = box.top + box.height - ((logValue - yTicks.lo) / (yTicks.hi - yTicks.lo || 1)) * box.height;
					if (!Number.isFinite(py) || py < box.top - 1 || py > box.top + box.height + 1) continue;
					nodes.push(h("line", { key: `yt${logValue}`, x1: box.left - tickLen, y1: py, x2: box.left, y2: py, stroke: colors.text, strokeWidth: 1.2 }));
					nodes.push(
						h("text", {
							key: `yl${logValue}`,
							x: box.left - tickLen - 6,
							y: py + 4.5,
							fill: colors.text,
							fontFamily: FONT_PLOT,
							fontSize: 13,
							textAnchor: "end"
						}, formatTick(Math.pow(10, logValue), 1))
					);
				}
			} else {
				for (const value of yTicks.minor) {
					const py = scales.sy(value);
					if (!Number.isFinite(py) || py < box.top - 1 || py > box.top + box.height + 1) continue;
					nodes.push(h("line", { key: `ym${value}`, x1: box.left, y1: py, x2: box.left + minorLen, y2: py, stroke: colors.border, strokeWidth: 1 }));
				}
				for (const value of yTicks.ticks) {
					const py = scales.sy(value);
					if (!Number.isFinite(py) || py < box.top - 1 || py > box.top + box.height + 1) continue;
					nodes.push(h("line", { key: `yt${value}`, x1: box.left - tickLen, y1: py, x2: box.left, y2: py, stroke: colors.text, strokeWidth: 1.2 }));
					nodes.push(
						h("text", {
							key: `yl${value}`,
							x: box.left - tickLen - 6,
							y: py + 4.5,
							fill: colors.text,
							fontFamily: FONT_PLOT,
							fontSize: 13,
							textAnchor: "end"
						}, formatTick(value, yTicks.step))
					);
				}
			}
			return nodes;
		}

		function svgAxisTitles(scales, axis, colors) {
			const box = scales.box;
			return [
				h("text", {
					key: "xtitle",
					x: box.left + box.width / 2,
					y: VB.h - 12,
					fill: colors.text,
					fontFamily: FONT_PLOT,
					fontSize: 15,
					textAnchor: "middle"
				}, axis.xLabel || "X"),
				h("text", {
					key: "ytitle",
					x: 22,
					y: box.top + box.height / 2,
					fill: colors.text,
					fontFamily: FONT_PLOT,
					fontSize: 15,
					textAnchor: "middle",
					transform: `rotate(-90 22 ${box.top + box.height / 2})`
				}, axis.yLabel || "Y")
			];
		}

		function curvePath(dataset, offset, scales) {
			const shift = Number.isFinite(offset) ? offset : 0;
			const buckets = Math.max(64, Math.round(scales.box.width / 2));
			const points = decimate(dataset.xs, dataset.ys, (x, y) => {
				if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
				const px = scales.sx(x);
				const py = scales.sy(y + shift);
				if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
				return [px, py];
			}, buckets);
			return pointsToPath(points);
		}

		function svgLegend(list, offsets, scales, colors) {
			const box = scales.box;
			if (list.length === 0) return null;
			const nodes = [];
			const lineH = 19;
			let y = box.top + 16;
			const x = box.left + box.width - 12;
			for (let i = 0; i < list.length; i++) {
				const item = list[i];
				nodes.push(h("line", { key: `lg${item.id}`, x1: x - 30, y1: y - 4.5, x2: x - 12, y2: y - 4.5, stroke: item.color, strokeWidth: Math.max(2, item.lineWidth || 2), strokeLinecap: "round" }));
				nodes.push(
					h("text", {
						key: `lt${item.id}`,
						x: x - 34,
						y: y,
						fill: colors.text,
						fontFamily: FONT_PLOT,
						fontSize: 13,
						textAnchor: "end"
					}, item.name)
				);
				y += lineH;
			}
			return h("g", { "data-legend": "1" }, nodes);
		}

		function svgGuides(guides, scales, colors) {
			if (!guides || guides.length === 0) return null;
			return h(
				"g",
				{ "data-guides": "1" },
				guides.map((guide) => {
					const px = scales.sx(guide.x);
					const box = scales.box;
					return h(
						"g",
						{ key: guide.id, "data-guide": guide.id, "data-x": guide.x },
						h("line", {
							x1: px,
							y1: box.top,
							x2: px,
							y2: box.top + box.height,
							stroke: guide.color,
							strokeWidth: 1.5,
							strokeDasharray: "6 4"
						}),
						h("rect", {
							x: px - 30,
							y: box.top - 1,
							width: 60,
							height: 17,
							rx: 3,
							fill: guide.color,
							opacity: 0.92
						}),
						h("text", {
							x: px,
							y: box.top + 12,
							fill: "#ffffff",
							fontFamily: FONT_PLOT,
							fontSize: 11,
							textAnchor: "middle",
							"data-guide-label": guide.id
						}, fmt(guide.x))
					);
				})
			);
		}
		//#endregion

		//#region render — stage component
		function Stage(props) {
			const state = props.state;
			const offsets = props.offsets;
			const view = props.view;
			const dispatch = props.dispatch;
			const svgRef = react.useRef(null);
			const stateRef = react.useRef(state);
			const offsetsRef = react.useRef(offsets);
			const viewRef = react.useRef(view);
			stateRef.current = state;
			offsetsRef.current = offsets;
			viewRef.current = view;

			const colors = readColors();
			const scales = makeScales(view, state.axis);
			const list = visibleList(state.datasets);
			const box = scales.box;

			react.useEffect(() => {
				const svg = svgRef.current;
				if (!svg) return undefined;
				return bindStageEvents(svg, svgRef, stateRef, offsetsRef, viewRef, dispatch);
			}, [dispatch]);

			return h(
				"svg",
				{
					ref: svgRef,
					className: "sp_svg",
					viewBox: `0 0 ${VB.w} ${VB.h}`,
					preserveAspectRatio: "xMidYMid meet",
					xmlns: "http://www.w3.org/2000/svg"
				},
				h(
					"defs",
					null,
					h(
						"clipPath",
						{ id: "sp-clip" },
						h("rect", { x: box.left, y: box.top, width: box.width, height: box.height })
					)
				),
				h("rect", { "data-bg": "1", x: 0, y: 0, width: VB.w, height: VB.h, fill: colors.bg }),
				h("g", { "data-axis": "1" }, svgAxisTicks(scales, view, state.axis, colors)),
				h(
					"g",
					{ "data-curves": "1", clipPath: "url(#sp-clip)" },
					list.map((item) => {
						const index = state.datasets.indexOf(item);
						const path = curvePath(item, offsets[index] || 0, scales);
						const selected = state.selected === item.id;
						return h("path", {
							key: item.id,
							d: path,
							fill: "none",
							stroke: item.color,
							strokeWidth: selected ? (item.lineWidth || 2) + 0.8 : item.lineWidth || 2,
							strokeLinejoin: "round",
							strokeLinecap: "round",
							opacity: selected ? 1 : 0.92
						});
					})
				),
				svgFrame(scales, colors.text),
				h("g", { "data-titles": "1" }, svgAxisTitles(scales, state.axis, colors)),
				svgLegend(list, offsets, scales, colors),
				h("g", { "data-interactive": "1", "data-guides-host": "1" }, svgGuides(state.guides, scales, colors)),
				h(
					"g",
					{ "data-interactive": "1", "data-cross": "1", opacity: 0 },
					h("line", { "data-cross-v": "1", x1: 0, y1: box.top, x2: 0, y2: box.top + box.height, stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }),
					h("line", { "data-cross-h": "1", x1: box.left, y1: 0, x2: box.left + box.width, y2: 0, stroke: colors.axis, strokeWidth: 1, strokeDasharray: "3 3" }),
					h("g", { "data-cross-dots": "1" }),
					h("g", { "data-cross-tip": "1" },
						h("rect", { "data-cross-tip-bg": "1", x: 0, y: 0, width: 150, height: 22, rx: 3, fill: colors.tooltipBg, stroke: colors.border, strokeWidth: 1 }),
						h("text", { "data-cross-tip-text": "1", x: 0, y: 0, fill: colors.text, fontFamily: FONT_PLOT, fontSize: 11 })
					)
				),
				h(
					"g",
					{ "data-interactive": "1", "data-box-zoom": "1", opacity: 0 },
					h("rect", { "data-box-rect": "1", x: 0, y: 0, width: 0, height: 0, fill: colors.axis, opacity: 0.12, stroke: colors.axis, strokeWidth: 1, strokeDasharray: "4 3" })
				)
			);
		}

		function readColors() {
			return {
				bg: "var(--dsw-alias-bg-layer-1, #ffffff)",
				text: "var(--dsw-alias-label-primary, #1f2328)",
				axis: "var(--dsw-alias-label-secondary, #5b6470)",
				border: "var(--dsw-alias-border-l1, #d8dde3)",
				tooltipBg: "var(--dsw-alias-bg-overlay, #ffffff)"
			};
		}
		//#endregion
