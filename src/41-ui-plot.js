		//#region ui — formula dialog
		const FORMULA_PRESETS = [
			{ label: "莫特-肖特基 1/C²", expr: "(2*pi*f*y)^2", hint: "y = Z''(Ω·cm²)，f 填测试频率（Hz）" },
			{ label: "平方 y²", expr: "y^2", hint: "" },
			{ label: "倒数 1/y", expr: "1/y", hint: "" },
			{ label: "反相 -y", expr: "-y", hint: "" },
			{ label: "百分透过率 T%", expr: "100*y", hint: "" }
		];

		function FormulaDialog(props) {
			const state = props.state;
			const dispatch = props.dispatch;
			const datasets = state.datasets;
			const initial = props.initialSource || (datasets[0] ? datasets[0].id : "");
			const [sourceId, setSourceId] = react.useState(initial);
			const [expr, setExpr] = react.useState("y");
			const [freq, setFreq] = react.useState("1000");
			const [hint, setHint] = react.useState("");
			const parsed = parseFormula(expr);
			const source = datasets.find((item) => item.id === sourceId) || datasets[0] || null;
			const columnCount = source && source.raw && source.raw.columns ? source.raw.columns.length : 2;
			const variables = ["x", "y", "f"];
			for (let i = 1; i <= Math.min(columnCount, 8); i++) variables.push(`col${i}`);

			const run = () => {
				if (source === null) {
					dispatch({ type: "NOTICE", tone: "warn", text: "没有可换算的曲线" });
					return;
				}
				if (!parsed.ok) {
					dispatch({ type: "NOTICE", tone: "err", text: parsed.error });
					return;
				}
				const frequency = Number(freq);
				const n = Math.min(source.xs.length, source.ys.length);
				const ys = new Float64Array(n);
				for (let i = 0; i < n; i++) {
					const row = i;
					ys[i] = evalNode(parsed.node, (name) => {
						if (name === "f") return Number.isFinite(frequency) ? frequency : undefined;
						if (name === "x") return source.xs[row];
						if (name === "y") return source.ys[row];
						const match = /^col(\d+)$/.exec(name);
						if (match) {
							const column = Number(match[1]) - 1;
							const columns = source.raw && source.raw.columns;
							if (columns && columns[column] !== undefined) return columns[column][row];
							if (column === 0) return source.xs[row];
							if (column === 1) return source.ys[row];
						}
						return undefined;
					});
				}
				dispatch({
					type: "ADD_DERIVED",
					dataset: {
						name: `${source.name} · ${expr}`,
						xs: source.xs,
						ys,
						raw: source.raw,
						xCol: source.xCol,
						yCol: source.yCol,
						op: { kind: "formula", label: expr.slice(0, 18), from: source.id },
						source: source.source
					}
				});
				dispatch({ type: "SET_DIALOG", dialog: null });
				dispatch({ type: "NOTICE", tone: "ok", text: "换算完成，新曲线已加入" });
			};

			return h(
				"div",
				{ className: "sp_scrim", role: "dialog", "aria-modal": "true" },
				h(
					"div",
					{ className: "sp_modal" },
					h("div", { className: "sp_modalTitle" }, "公式换算"),
					h(
						"label",
						{ className: "sp_field" },
						h("span", { className: "sp_label" }, "源曲线"),
						h(
							"select",
							{
								className: "sp_input",
								value: source ? source.id : "",
								onChange: (event) => setSourceId(event.target.value)
							},
							datasets.map((item) => h("option", { key: item.id, value: item.id }, item.name))
						)
					),
					h(
						"label",
						{ className: "sp_field" },
						h("span", { className: "sp_label" }, "表达式"),
						h("input", {
							className: "sp_input",
							value: expr,
							style: { fontFamily: "ui-monospace, Consolas, monospace" },
							onChange: (event) => setExpr(event.target.value)
						})
					),
					h(
						"div",
						{ className: "sp_label" },
						parsed.ok ? `可用变量：${variables.join(" / ")}` : `⚠ ${parsed.error}`
					),
					h(
						"div",
						{ className: "sp_pathRow" },
						FORMULA_PRESETS.map((preset) =>
							h(
								"button",
								{
									key: preset.label,
									type: "button",
									className: "sp_btn",
									title: preset.hint,
									onClick: () => {
										setExpr(preset.expr);
										setHint(preset.hint);
									}
								},
								preset.label
							)
						)
					),
					h(
						"label",
						{ className: "sp_field" },
						h("span", { className: "sp_label" }, "f（频率，Hz，公式里写 f 时生效）"),
						h("input", {
							className: "sp_input",
							type: "number",
							step: "any",
							value: freq,
							onChange: (event) => setFreq(event.target.value)
						})
					),
					hint ? h("div", { className: "sp_label" }, hint) : null,
					h(
						"div",
						{ className: "sp_modalFoot" },
						h(
							"button",
							{ type: "button", className: "sp_btn", onClick: () => dispatch({ type: "SET_DIALOG", dialog: null }) },
							"取消"
						),
						h("button", { type: "button", className: "sp_btn sp_btnPrimary", onClick: run }, "生成新曲线")
					)
				)
			);
		}
		//#endregion

		//#region ui — plot screen
		function pickedDataset(state) {
			const found = state.datasets.find((item) => item.id === state.selected);
			if (found) return found;
			return state.datasets.length > 0 ? state.datasets[state.datasets.length - 1] : null;
		}

		function stamp() {
			const now = new Date();
			const pad = (value) => String(value).padStart(2, "0");
			return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
		}

		function PlotScreen(props) {
			const state = props.state;
			const dispatch = props.dispatch;
			const frame = frameById(state.frameId);
			const stageRef = react.useRef(null);
			const [pathText, setPathText] = react.useState("");
			const [busy, setBusy] = react.useState(false);

			const offsets = liveOffsets(state.datasets);
			const auto = computeAutoView(state.datasets, offsets, state.axis.reverseX);
			const view = state.view !== null && state.view !== undefined ? state.view : auto || { xLo: 0, xHi: 1, yLo: 0, yHi: 1 };
			const fileName = `${(frame ? frame.id : "plot")}-${stamp()}`;

			const svgEl = () => {
				if (!stageRef.current) return null;
				return stageRef.current.querySelector("svg.sp_svg");
			};

			const notice = (tone, text) => dispatch({ type: "NOTICE", tone, text });

			const runDerive = () => {
				const source = pickedDataset(state);
				if (source === null) {
					notice("warn", "先导入曲线，并在右栏选中一条，再求导");
					return;
				}
				if (source.xs.length < 3) {
					notice("warn", "这条曲线的点太少，无法求导");
					return;
				}
				const ys = differentiate(source.xs, source.ys);
				dispatch({
					type: "ADD_DERIVED",
					dataset: {
						name: `${source.name} · d/dx`,
						xs: source.xs,
						ys,
						raw: source.raw,
						xCol: source.xCol,
						yCol: source.yCol,
						op: { kind: "diff", label: "d/dx", from: source.id },
						source: source.source
					}
				});
				notice("ok", "已生成导数曲线（原曲线保留）");
			};

			const onTool = (id) => {
				if (id === "pan" || id === "zoom") {
					dispatch({ type: "SET_TOOL", tool: id });
					return;
				}
				if (id === "reset") {
					dispatch({ type: "SET_VIEW", view: null });
					return;
				}
				if (id === "guide") {
					const center = (view.xLo + view.xHi) / 2;
					dispatch({ type: "ADD_GUIDE", x: center });
					return;
				}
				if (id === "derive") {
					runDerive();
					return;
				}
				if (id === "png") {
					const element = svgEl();
					if (element === null) return;
					notice("info", "正在导出 PNG…");
					exportPng(element, fileName).then(
						() => notice("ok", "PNG 已导出"),
						(error) => notice("err", `PNG 导出失败：${error.message}`)
					);
					return;
				}
				if (id === "svg") {
					const element = svgEl();
					if (element === null) return;
					try {
						exportSvg(element, fileName);
						notice("ok", "SVG 已导出");
					} catch (error) {
						notice("err", `SVG 导出失败：${error.message}`);
					}
					return;
				}
				if (id === "clear") {
					dispatch({ type: "CLEAR_ALL" });
					notice("info", "已清空");
				}
			};

			const commitRange = (key, text) => {
				const value = Number(text);
				if (!Number.isFinite(value)) return;
				if (text.trim() === "") return;
				const next = Object.assign({}, view, { [key]: value });
				if (!(Math.abs(next.xHi - next.xLo) > 0) || !(Math.abs(next.yHi - next.yLo) > 0)) return;
				dispatch({ type: "SET_VIEW", view: next });
			};

			const toggleReverse = (checked) => {
				dispatch({ type: "PATCH_AXIS", patch: { reverseX: checked } });
				if (state.view !== null && state.view !== undefined) {
					dispatch({ type: "SET_VIEW", view: { xLo: view.xHi, xHi: view.xLo, yLo: view.yLo, yHi: view.yHi } });
				}
			};

			const handleFiles = async (files) => {
				if (busy) return;
				setBusy(true);
				try {
					const result = await readFileEntries(files);
					loadInto(state, dispatch, result);
				} finally {
					setBusy(false);
				}
			};

			const handlePaths = async () => {
				const paths = pathText
					.split(/[\n;]+/)
					.map((piece) => piece.trim().replace(/^["']|["']$/g, ""))
					.filter((piece) => piece.length > 0);
				if (paths.length === 0) return;
				if (busy) return;
				setBusy(true);
				try {
					const result = await readPathEntries(paths);
					loadInto(state, dispatch, result);
					if (result.ok.length > 0) setPathText("");
				} finally {
					setBusy(false);
				}
			};

			return h(
				"div",
				{ className: "sp_root" },
				h(
					"div",
					{ className: "sp_bar" },
					h(
						"div",
						{ className: "sp_crumb" },
						h(
							"button",
							{ type: "button", className: "sp_crumbBtn", onClick: () => dispatch({ type: "GO_HOME" }) },
							"‹ 返回"
						),
						h("span", null, "/"),
						h("span", null, frame ? frame.title : "")
					),
					h("div", { className: "sp_barSpacer" }),
					h("span", { className: "sp_hint" }, "滚轮缩放 · 双击复位 · 右键加竖线")
				),
				h(
					"div",
					{ className: "sp_work" },
				h(ToolRail, { state, dispatch, onTool }),
				h(
					"div",
					{ className: "sp_stage" },
					h(
						"div",
						{
							className: "sp_plotBox",
							ref: stageRef,
							onDragOver: (event) => {
								event.preventDefault();
								event.dataTransfer.dropEffect = "copy";
							},
							onDrop: (event) => {
								event.preventDefault();
								const files = Array.prototype.slice.call(event.dataTransfer.files || []);
								if (files.length === 0) {
									notice("warn", "没有读到文件。文件夹请先展开，或改用下面的路径导入。");
									return;
								}
								handleFiles(files);
							}
						},
						h(Stage, { key: state.frameId, state, offsets, view, dispatch }),
						state.datasets.length === 0
							? h(
									"div",
									{
										style: {
											position: "absolute",
											inset: 0,
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											justifyContent: "center",
											gap: 4,
											pointerEvents: "none",
											color: "var(--dsw-alias-label-secondary,#9a9aa8)"
										}
									},
									h("div", { style: { fontSize: 14, fontWeight: 600 } }, "把数据文件拖到这里"),
									h("div", { style: { fontSize: 12 } }, "支持 .txt / .csv / .dat / .dpt / .tsv，也可以粘贴本地路径")
								)
							: null
					),
					h(
						"div",
						{ className: "sp_pathRow" },
						h("input", {
							className: "sp_input",
							placeholder: "粘贴本地文件路径，多行或分号分隔，例如 D:\\Research\\data\\xrd\\a.txt",
							value: pathText,
							onChange: (event) => setPathText(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter") handlePaths();
							}
						}),
						h(
							"button",
							{ type: "button", className: "sp_btn sp_btnPrimary", onClick: handlePaths, disabled: busy },
							busy ? "读取中…" : "导入路径"
						)
					),
					h(Notice, { notice: state.notice })
				),
				h(SidePanel, {
					state,
					dispatch,
					offsets,
					view,
					onRange: commitRange,
					onReverse: toggleReverse
				}),
					state.dialog && state.dialog.kind === "formula"
						? h(FormulaDialog, { state, dispatch, initialSource: state.dialog.sourceId })
						: null
				)
			);
		}
		//#endregion

		//#region ui — app root
		function SciPlotApp() {
			const [state, setState] = react.useState(initialState);
			const dispatch = react.useCallback((action) => {
				setState((previous) => reducer(previous, action));
			}, []);
			react.useEffect(() => {
				if (!state.notice) return undefined;
				const timer = setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), 4600);
				return () => clearTimeout(timer);
			}, [state.notice]);
			if (state.screen === "home") return h(HomeScreen, { dispatch });
			return h(PlotScreen, { state, dispatch });
		}

		function SciPlotIcon(props) {
			const size = props && props.size ? props.size : 16;
			const active = props && props.active;
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: active ? 1.6 : 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				},
				h("path", { d: "M1.6 2.4v11.2h12.8" }),
				h("path", { d: "M3.6 11.2l2.3-3.4 2 2.1 2.2-4.6 2.3 3.1" })
			);
		}
		//#endregion
