		//#region import — files and paths
		function base64ToBytes(base64) {
			const binary = atob(base64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
			return bytes;
		}

		function tableToDataset(name, table) {
			if (!table || table.ok !== true) return null;
			const columns = table.columns || [];
			if (columns.length < 2) return null;
			const xs = Float64Array.from(columns[0]);
			const ys = Float64Array.from(columns[1]);
			const range = finiteNumbers(ys);
			if (!Number.isFinite(range.lo) && !Number.isFinite(range.hi)) return null;
			return {
				name: displayName(name),
				xs,
				ys,
				raw: { columns, columnNames: table.columnNames || [] },
				xCol: 0,
				yCol: 1
			};
		}

		/** Standard card → card dataset. Intensity stays raw (0~100); the store scales it. */
		function cardToDataset(name, card, source) {
			if (!card || card.ok !== true) return null;
			if (!card.xs || card.xs.length < 2) return null;
			const fromName = /PDF[#\s]*([0-9]{2}-[0-9]{3}-[0-9]{4})/i.exec(String(name));
			const cardNo = card.cardNo || (fromName === null ? null : fromName[1]);
			const label = displayName(name);
			const alreadyNamed = fromName !== null;
			return {
				name: cardNo === null || alreadyNamed ? label : `${label} (PDF#${cardNo})`,
				xs: card.xs,
				ys: card.ys,
				kind: "card",
				cardNo,
				raw: null,
				source: source || "file"
			};
		}

		async function readFileEntries(files, cardMode) {
			const ok = [];
			const bad = [];
			for (const file of files) {
				try {
					const bytes = new Uint8Array(await file.arrayBuffer());
					const decoded = decodeBytes(bytes);
					if (cardMode) {
						const card = parseCardTable(decoded.text);
						if (!card.ok) {
							bad.push(`${file.name}：${card.reason}`);
							continue;
						}
						const entry = cardToDataset(file.name, card, "file");
						if (entry === null) {
							bad.push(`${file.name}：卡片里没有可用的峰位`);
							continue;
						}
						ok.push(entry);
						continue;
					}
					const table = parseTable(decoded.text);
					if (!table.ok) {
						bad.push(`${file.name}：${table.reason}`);
						continue;
					}
					const entry = tableToDataset(file.name, table);
					if (entry === null) {
						bad.push(`${file.name}：没有可用的数值列`);
						continue;
					}
					entry.source = "file";
					entry.hasHeader = table.columnNames.some((cell) => cell !== null);
					ok.push(entry);
				} catch (error) {
					bad.push(`${file.name}：${error && error.message ? error.message : "读取失败"}`);
				}
			}
			return { ok, bad };
		}

		async function readPathEntry(path, cardMode) {
			const response = await fetch(READ_URL, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ path })
			});
			const data = await response.json().catch(() => null);
			if (!response.ok || data === null || data.ok !== true) {
				const reason = data && (data.message || data.error) ? data.message || data.error : `HTTP ${response.status}`;
				throw new Error(String(reason));
			}
			const bytes = base64ToBytes(data.base64);
			const decoded = decodeBytes(bytes);
			const label = data.name || path;
			if (cardMode) {
				const card = parseCardTable(decoded.text);
				if (!card.ok) throw new Error(card.reason);
				const cardEntry = cardToDataset(label, card, "path");
				if (cardEntry === null) throw new Error("卡片里没有可用的峰位");
				return cardEntry;
			}
			const table = parseTable(decoded.text);
			if (!table.ok) throw new Error(table.reason);
			const entry = tableToDataset(label, table);
			if (entry === null) throw new Error("没有可用的数值列");
			entry.source = "path";
			entry.hasHeader = table.columnNames.some((cell) => cell !== null);
			return entry;
		}

		async function readPathEntries(paths, cardMode) {
			const ok = [];
			const bad = [];
			for (const path of paths) {
				try {
					ok.push(await readPathEntry(path, cardMode));
				} catch (error) {
					bad.push(`${path}：${error && error.message ? error.message : "读取失败"}`);
				}
			}
			return { ok, bad };
		}

		function loadInto(state, dispatch, result, cardMode) {
			if (result.ok.length > 0) {
				dispatch({ type: cardMode ? "ADD_CARD" : "ADD_DATASETS", list: result.ok });
				if (result.bad.length > 0) {
					dispatch({ type: "NOTICE", tone: "warn", text: `导入 ${result.ok.length} 条，跳过 ${result.bad.length} 条：${result.bad[0]}` });
				}
			} else if (result.bad.length > 0) {
				dispatch({ type: "NOTICE", tone: "err", text: result.bad[0] });
			}
		}
		//#endregion

		//#region ui — small pieces
		function FrameGlyph(props) {
			const common = {
				width: 22,
				height: 22,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			};
			if (props.kind === "ftir") {
				return h(
					"svg",
					common,
					h("path", { d: "M2 17h3l1.4-9 1.8 13 1.6-8 1.4 4 1.6-6 1.4 5 1.6-8 1.4 9h6" })
				);
			}
			return h(
				"svg",
				common,
				h("path", { d: "M2 19h2.2l1.2-6 1.1 3 1-9 1.1 12 1.2-7 1.1 2 1.2-1 1.3 1 1.2-8 1.3 13 1.2-4 1.1 1h5" })
			);
		}

		function ToolIcon(props) {
			const common = {
				width: 18,
				height: 18,
				viewBox: "0 0 20 20",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			};
			const id = props.id;
			if (id === "pan") {
				return h("svg", common, h("path", { d: "M10 3v14M3 10h14M10 3l-2 2M10 3l2 2M10 17l-2-2M10 17l2-2M3 10l2-2M3 10l2 2M17 10l-2-2M17 10l-2 2" }));
			}
			if (id === "zoom") {
				return h("svg", common, h("circle", { cx: 8.5, cy: 8.5, r: 5 }), h("path", { d: "M12.5 12.5L17 17M6 8.5h5M8.5 6v5" }));
			}
			if (id === "reset") {
				return h("svg", common, h("path", { d: "M4 10a6 6 0 1 0 2-4.6M4 4.4V8h3.6" }));
			}
			if (id === "guide") {
				return h("svg", common, h("path", { d: "M6 3v14" }), h("path", { d: "M10 6h7M10 10h7M10 14h5", strokeDasharray: "2 2" }));
			}
			if (id === "derive") {
				return h("svg", common, h("path", { d: "M3 15c4.5 0 5-10 9.5-10" }), h("path", { d: "M11 4.4l2 1.6-1.6 2" }));
			}
			if (id === "formula") {
				return h("svg", common, h("path", { d: "M6 16.5L9.5 3.5M12.5 7.5h5M15 5v5" }));
			}
			if (id === "png") {
				return h("svg", common, h("rect", { x: 3, y: 3.5, width: 14, height: 13, rx: 2 }), h("circle", { cx: 7.2, cy: 7.6, r: 1.4 }), h("path", { d: "M3.4 13.6l3.8-3.6 2.8 2.6 1.9-1.8 4.7 4.4" }));
			}
			if (id === "svg") {
				return h("svg", common, h("path", { d: "M10 3v9.5M6.4 9l3.6 3.6L13.6 9" }), h("path", { d: "M3.5 16h13" }));
			}
			return h("svg", common, h("path", { d: "M4 6h12M8 6V4h4v2M6.5 6l.9 10.5h5.2L13.5 6" }));
		}

		function section(title, content, extra) {
			return h(
				"div",
				{ className: "sp_sec", key: title },
				h("div", { className: "sp_secHead" }, h("span", { className: "sp_secTitle" }, title), extra || null),
				content
			);
		}

		function Notice(props) {
			if (!props.notice) return null;
			const tone = props.notice.tone;
			const color =
				tone === "err"
					? "var(--dsw-alias-state-error-primary, #c0392b)"
					: tone === "ok"
						? "var(--dsw-alias-state-success-primary, #2e7d52)"
						: tone === "warn"
							? "var(--dsw-alias-state-warn-primary, #b7791f)"
							: "var(--dsw-alias-label-secondary, #5b6470)";
			return h(
				"div",
				{ className: "sp_notice", role: "status" },
				h("span", { className: "sp_noticeText", style: { color } }, props.notice.text)
			);
		}
		//#endregion

		//#region ui — home
		function HomeScreen(props) {
			const dispatch = props.dispatch;
			return h(
				"div",
				{ className: "sp_home" },
				h("div", { className: "sp_homeTitle" }, "科研绘图"),
				h(
					"div",
					{ className: "sp_homeSub" },
					"选一类数据进入绘图台。数据文件可以直接拖进绘图区，也可以粘贴本地路径；曲线可缩放、读数、求导、按公式换算。"
				),
				h(
					"div",
					{ className: "sp_cards" },
					FRAMES.map((frame) =>
						h(
							"button",
							{
								key: frame.id,
								type: "button",
								className: "sp_card",
								onClick: () => dispatch({ type: "OPEN_FRAME", frameId: frame.id })
							},
							h(
								"div",
								{ className: "sp_cardHead" },
								h("span", { className: "sp_cardIcon" }, h(FrameGlyph, { kind: frame.glyph })),
								h("span", { className: "sp_cardName" }, frame.title)
							),
						)
					)
				)
			);
		}
		//#endregion

		//#region ui — tool rail
		const TOOL_ITEMS = [
			{ id: "pan", icon: "pan", title: "选择 / 平移（在图中拖动）" },
			{ id: "zoom", icon: "zoom", title: "框选放大（在图中拖出矩形）" },
			{ id: "reset", icon: "reset", title: "复位视图（双击图内也可）" },
			{ id: "guide", icon: "guide", title: "加一条可拖动竖线（图中右键也可）" },
			{ id: "derive", icon: "derive", title: "对选中曲线求导" },
			{ id: "sep" },
			{ id: "png", icon: "png", title: "导出 PNG（3 倍像素）" },
			{ id: "svg", icon: "svg", title: "导出 SVG（矢量）" },
			{ id: "clear", icon: "clear", title: "清空所有曲线与竖线" }
		];

		function ToolRail(props) {
			const state = props.state;
			const dispatch = props.dispatch;
			return h(
				"div",
				{ className: "sp_tools" },
				TOOL_ITEMS.map((item) => {
					if (item.id === "sep") return h("div", { key: "sep", className: "sp_toolSep" });
					const active = item.id === "pan" || item.id === "zoom" ? state.tool === item.id : false;
					return h(
						"button",
						{
							key: item.id,
							type: "button",
							className: "sp_tool" + (active ? " sp_toolOn" : ""),
							title: item.title,
							"aria-label": item.title,
							onClick: () => props.onTool(item.id)
						},
						h(ToolIcon, { id: item.icon })
					);
				})
			);
		}
		//#endregion

		//#region ui — side panel
		function SidePanel(props) {
			const state = props.state;
			const dispatch = props.dispatch;
			const offsets = props.offsets;

			// 取色器：原生 <input type="color"> 藏在行内（不可见、1px），
			// 由色块触发 click() 打开系统取色面板。
			const colorInputs = react.useRef({});
			const openColor = (key) => {
				const node = colorInputs.current[key];
				if (node && typeof node.click === "function") node.click();
			};
			const colorInput = (key, color, onChange) =>
				h("input", {
					type: "color",
					className: "sp_colorHidden",
					tabIndex: -1,
					"aria-hidden": "true",
					value: colorInputValue(color, PALETTE[0]),
					ref: (node) => {
						if (node === null) delete colorInputs.current[key];
						else colorInputs.current[key] = node;
					},
					onChange
				});

			const datasetRows = state.datasets.map((item, index) =>
				h(
					"div",
					{ key: item.id, className: "sp_row" + (state.selected === item.id ? " sp_rowOn" : "") },
					// 单击 = 选中（原有行为不变）；双击 = 改颜色。
					h(
						"span",
						{
							className: "sp_swatch",
							style: { background: item.color },
							onClick: () => dispatch({ type: "SELECT", id: item.id }),
							onDoubleClick: () => openColor("ds:" + item.id),
							title: "单击选中这条曲线 · 双击修改颜色"
						},
						h("span", { className: "sp_swatchMark" })
					),
					colorInput("ds:" + item.id, item.color, (event) =>
						dispatch({ type: "PATCH_DATASET", id: item.id, patch: { color: event.target.value } })
					),
					h(
						"button",
						{
							type: "button",
							className: "sp_dsname",
							title: item.name,
							onClick: () => dispatch({ type: "SELECT", id: item.id })
						},
						item.name
					),
					item.kind === "card"
						? h("span", { className: "sp_badge", title: item.cardNo ? `PDF#${item.cardNo}` : "标准卡片" }, "卡片")
						: null,
					item.op ? h("span", { className: "sp_badge" }, item.op.label) : null,
					h("input", {
						type: "checkbox",
						checked: item.visible !== false,
						title: "显示 / 隐藏",
						onChange: (event) => dispatch({ type: "PATCH_DATASET", id: item.id, patch: { visible: event.target.checked } })
					}),
					h(
						"button",
						{
							type: "button",
							className: "sp_iconBtn",
							title: "删除这条曲线",
							onClick: () => dispatch({ type: "REMOVE_DATASET", id: item.id })
						},
						"×"
					)
				)
			);

			const offsetRows =
				state.datasets.length === 0
					? null
					: h(
							"div",
							null,
							h(
								"div",
								{ className: "sp_row" },
								h(
									"button",
									{
										type: "button",
										className: "sp_btn",
										title: "所有实测曲线改为自动堆叠（标准卡片不参与，它由两条分割线控制）",
										onClick: () => dispatch({ type: "SET_ALL_OFFSET_MODE", mode: "auto" })
									},
									"全部自动堆叠"
								),
								h(
									"button",
									{
										type: "button",
										className: "sp_btn",
										title: "所有实测曲线回到偏移 0（标准卡片不参与）",
										onClick: () => dispatch({ type: "SET_ALL_OFFSET_MODE", mode: "off" })
									},
									"全部不偏移"
								)
							),
							state.datasets.map((item) =>
								h(
									"div",
									{ key: "off" + item.id, className: "sp_row" },
									h("span", { className: "sp_label", style: { width: 92, flex: "0 0 auto" } }, item.name),
									h(
										"select",
										{
											className: "sp_input",
											value: item.offsetMode || "auto",
											onChange: (event) => dispatch({ type: "PATCH_DATASET", id: item.id, patch: { offsetMode: event.target.value } })
										},
										h("option", { value: "auto" }, "自动堆叠"),
										h("option", { value: "manual" }, "手动"),
										h("option", { value: "off" }, "不偏移")
									),
									h("input", {
										className: "sp_input",
										type: "number",
										step: "any",
										style: { width: 74, flex: "0 0 auto" },
										value: Number.isFinite(item.yOffset) ? item.yOffset : 0,
										disabled: (item.offsetMode || "auto") !== "manual",
										onChange: (event) =>
											dispatch({ type: "PATCH_DATASET", id: item.id, patch: { yOffset: Number(event.target.value) || 0 } })
									})
								)
							)
						);

			const rangeField = (label, key) =>
				h(
					"label",
					{ className: "sp_rangeField" },
					h("span", { className: "sp_label" }, label),
					h("input", {
						className: "sp_input",
						type: "number",
						step: "any",
						value: fmt(props.view[key]),
						onChange: (event) => props.onRange(key, event.target.value)
					})
				);

			const rangeBoxes = h(
				"div",
				null,
				h(
					"div",
					{ className: "sp_rangeGrid" },
					rangeField("X min", "xLo"),
					rangeField("X max", "xHi"),
					rangeField("Y min", "yLo"),
					rangeField("Y max", "yHi")
				),
				h(
					"button",
					{ type: "button", className: "sp_btn", onClick: () => dispatch({ type: "SET_VIEW", view: null }) },
					"自动适应全部曲线"
				)
			);

			const axisPhrase = h(
				"div",
				null,
				h(
					"label",
					{ className: "sp_field" },
					h("span", { className: "sp_label" }, "X 轴标题"),
					h("input", {
						className: "sp_input",
						value: state.axis.xLabel,
						onChange: (event) => dispatch({ type: "PATCH_AXIS", patch: { xLabel: event.target.value } })
					})
				),
				h(
					"label",
					{ className: "sp_field" },
					h("span", { className: "sp_label" }, "Y 轴标题"),
					h("input", {
						className: "sp_input",
						value: state.axis.yLabel,
						onChange: (event) => dispatch({ type: "PATCH_AXIS", patch: { yLabel: event.target.value } })
					})
				),
				h(
					"label",
					{ className: "sp_check" },
					h("input", {
						type: "checkbox",
						checked: !!state.axis.reverseX,
						onChange: (event) => props.onReverse(event.target.checked)
					}),
					"X 轴反向（红外 / XPS 用）"
				),
				h(
					"label",
					{ className: "sp_check" },
					h("input", {
						type: "checkbox",
						checked: !!state.axis.yLog,
						onChange: (event) => dispatch({ type: "PATCH_AXIS", patch: { yLog: event.target.checked } })
					}),
					"Y 轴取对数"
				)
			);

			const guideRows =
				state.guides.length === 0
					? h("div", { className: "sp_label" }, "还没有竖线。左栏点「加竖线」，或在图中右键。")
					: state.guides.map((guide) =>
							h(
								"div",
								{ key: guide.id, className: "sp_row" },
								// 竖线的色块没有「选中」语义，单击直接开取色器。
								h(
									"span",
									{
										className: "sp_swatch",
										style: { background: guide.color },
										onClick: () => openColor("guide:" + guide.id),
										title: "单击修改竖线颜色"
									},
									h("span", { className: "sp_swatchMark" })
								),
								colorInput("guide:" + guide.id, guide.color, (event) =>
									dispatch({ type: "PATCH_GUIDE", id: guide.id, patch: { color: event.target.value } })
								),
								h("input", {
									className: "sp_input",
									type: "number",
									step: "any",
									value: fmt(guide.x),
									onChange: (event) => {
										const value = Number(event.target.value);
										if (Number.isFinite(value)) dispatch({ type: "PATCH_GUIDE", id: guide.id, patch: { x: value } });
									}
								}),
								h(
									"button",
									{ type: "button", className: "sp_iconBtn", title: "删除", onClick: () => dispatch({ type: "REMOVE_GUIDE", id: guide.id }) },
									"×"
								)
							)
						);

			return h(
				"div",
				{ className: "sp_side" },
				section(
					"数据曲线",
					state.datasets.length === 0
						? h("div", { className: "sp_label" }, "还没有数据。把文件拖进绘图区，或在下方粘贴路径。")
						: h("div", null, datasetRows, h("div", { className: "sp_divider" }), h("div", { className: "sp_label" }, "Y 偏移"), offsetRows),
					h("span", { className: "sp_badge" }, String(state.datasets.length))
				),
				section("坐标轴", h("div", null, axisPhrase, h("div", { className: "sp_divider" }), h("div", { className: "sp_label" }, "显示范围"), rangeBoxes)),
				section("竖线", guideRows)
			);
		}
		//#endregion
