		//#region pure — offsets and auto view
		/* @pure-begin */
		/**
		 * Offsets are a function of the whole ordered list, so they cannot live on
		 * a dataset. Auto series stack onto the previous one; manual keeps its
		 * number; off sits at zero. Everything downstream uses this array.
		 */
		function liveOffsets(datasets) {
			const list = datasets || [];
			const n = list.length;
			const out = new Array(n).fill(0);
			if (n === 0) return out;
			const spans = list.map((item) => {
				const range = finiteNumbers(item.ys);
				return range.hi - range.lo;
			});
			const gap = Math.max.apply(null, spans.concat([0])) * 0.08;
			out[0] = list[0].offsetMode === "manual" ? list[0].yOffset || 0 : 0;
			for (let i = 1; i < n; i++) {
				const mode = list[i].offsetMode || "auto";
				if (mode === "manual") {
					out[i] = list[i].yOffset || 0;
					continue;
				}
				if (mode === "off") {
					out[i] = 0;
					continue;
				}
				const prev = finiteNumbers(list[i - 1].ys);
				const current = finiteNumbers(list[i].ys);
				out[i] = out[i - 1] + prev.hi - current.lo + gap;
			}
			return out;
		}

		/**
		 * Range that fits every visible series, or null when nothing is visible.
		 * The X padding stays tight (1%) because a spectrum's edges are data, not
		 * slack; the Y padding is 5% so the top curve never touches the frame.
		 */
		function computeAutoView(datasets, offsets, reverseX) {
			const list = datasets || [];
			let xLo = Infinity;
			let xHi = -Infinity;
			let yLo = Infinity;
			let yHi = -Infinity;
			let any = false;
			for (let k = 0; k < list.length; k++) {
				const item = list[k];
				if (item.visible === false) continue;
				const offset = offsets[k] || 0;
				const xs = item.xs;
				const ys = item.ys;
				const n = Math.min(xs.length, ys.length);
				let local = false;
				for (let i = 0; i < n; i++) {
					const x = xs[i];
					const y = ys[i];
					if (Number.isFinite(x)) {
						any = true;
						if (x < xLo) xLo = x;
						if (x > xHi) xHi = x;
					}
					if (Number.isFinite(y) && Number.isFinite(x)) {
						const value = y + offset;
						if (value < yLo) yLo = value;
						if (value > yHi) yHi = value;
					}
				}
			}
			if (!any || !Number.isFinite(xLo) || !Number.isFinite(yLo)) return null;
			const xSpan = xHi - xLo;
			const xPad = xSpan > 0 ? xSpan * 0.01 : Math.abs(xHi) * 0.01 || 1;
			const ySpan = yHi - yLo;
			const yPad = ySpan > 0 ? ySpan * 0.05 : Math.abs(yHi) * 0.05 || 0.05;
			let x0 = xLo - xPad;
			let x1 = xHi + xPad;
			if (reverseX) {
				const swap = x0;
				x0 = x1;
				x1 = swap;
			}
			return { xLo: x0, xHi: x1, yLo: yLo - yPad, yHi: yHi + yPad };
		}
		/* @pure-end */
		//#endregion

		//#region state
		/* @pure-begin */
		const FRAMES = [
			{
				id: "ftir",
				title: "红外 FTIR",
				glyph: "ftir",
				desc: "透过率 / 吸光度谱。X 轴默认 4000 → 400 反向，多条样品按偏移堆叠并自动留 8% 间隙。",
				badges: ["Wavenumber (cm\u207B\u00B9)", "堆叠叠加", ".txt / .csv / .dpt"],
				xLabel: "Wavenumber (cm\u207B\u00B9)",
				yLabel: "Intensity (a.u.)",
				reverseX: true,
				stack: true
			},
			{
				id: "xrd",
				title: "X 射线衍射 XRD",
				glyph: "xrd",
				desc: "衍射强度随 2θ 变化。X 轴默认 5 → 80 正向，多条曲线不堆叠，叠在一起直接对比峰位。",
				badges: ["2θ (degree)", "不堆叠", ".txt / .csv / .dat"],
				xLabel: "2\u03B8 (degree)",
				yLabel: "Intensity (a.u.)",
				reverseX: false,
				stack: false
			}
		];

		function frameById(id) {
			for (const frame of FRAMES) if (frame.id === id) return frame;
			return null;
		}

		let SEQ = 0;
		function nextId(prefix) {
			SEQ += 1;
			return `${prefix}${SEQ}`;
		}

		const initialState = {
			screen: "home",
			frameId: null,
			datasets: [],
			guides: [],
			view: null,
			axis: { xLabel: "", yLabel: "", reverseX: false, yLog: false },
			tool: "pan",
			selected: null,
			selectedGuide: null,
			notice: null,
			dialog: null
		};

		function withNotice(state, tone, text) {
			return Object.assign({}, state, { notice: text === null ? null : { tone, text, at: Date.now() } });
		}

		function reducer(state, action) {
			switch (action.type) {
				case "OPEN_FRAME": {
					const frame = frameById(action.frameId);
					if (frame === null) return state;
					return Object.assign({}, state, {
						screen: "plot",
						frameId: frame.id,
						datasets: [],
						axis: {
							xLabel: frame.xLabel,
							yLabel: frame.yLabel,
							reverseX: frame.reverseX,
							yLog: false
						},
						view: null,
						tool: "pan",
						selected: null,
						guides: [],
						notice: null,
						dialog: null
					});
				}
				case "GO_HOME":
					return Object.assign({}, state, {
						screen: "home",
						frameId: null,
						datasets: [],
						guides: [],
						view: null,
						selected: null,
						notice: null,
						dialog: null
					});
				case "ADD_DATASETS": {
					const frame = frameById(state.frameId);
					const base = state.datasets.length;
					const incoming = action.list.map((item, index) => ({
						id: nextId("ds"),
						name: item.name,
						xs: item.xs,
						ys: item.ys,
						raw: item.raw || null,
						color: item.color || nextColor(base + index),
						visible: true,
						lineWidth: 2,
						yOffset: 0,
						offsetMode: frame !== null && frame.stack ? "auto" : "off",
						op: null,
						source: item.source || null
					}));
					if (incoming.length === 0) return state;
					return Object.assign({}, state, {
						datasets: state.datasets.concat(incoming),
						selected: incoming[incoming.length - 1].id,
						view: null,
						notice: null
					});
				}
				case "ADD_CARD": {
					const incoming = action.list || [];
					if (incoming.length === 0) return state;
					// 卡片的 I(f) 是相对强度（0~100），和实测谱的 cps 差几个数量级。
					// 按现有曲线的 Y 跨度把每张卡片缩到约 16% 高，再整体挪到数据下方，
					// 这样两者才在同一张图里比例正常地叠起来。
					let lo = Infinity;
					let hi = -Infinity;
					for (const item of state.datasets) {
						if (item.kind === "card") continue;
						for (let i = 0; i < item.ys.length; i++) {
							const value = item.ys[i];
							if (!Number.isFinite(value)) continue;
							if (value < lo) lo = value;
							if (value > hi) hi = value;
						}
					}
					const span = Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? hi - lo : 100;
					const height = span * 0.16;
					const stackBase = Number.isFinite(lo) ? lo - height * 1.4 : 0;
					const made = incoming.map((item, index) => ({
						id: nextId("cd"),
						name: item.name,
						xs: item.xs,
						ys: item.ys,
						kind: "card",
						cardNo: item.cardNo || null,
						cardHeight: height,
						raw: null,
						color: item.color || nextColor(state.datasets.length + index),
						visible: true,
						lineWidth: 2,
						yOffset: stackBase - index * height * 1.35,
						offsetMode: "manual",
						op: null,
						source: item.source || null
					}));
					const next = state.datasets.concat(made);
					// PDF 卡片常列到 150° 以上，而实测谱一般只扫到 80°。若直接自动适应，
					// 谱图会被挤到左边三分之一。已有实测谱时把初始 X 范围收在谱图自身，
					// 卡片超出部分交给用户按需拉回（「自动适应全部曲线」或改显示范围）。
					let dataXLo = Infinity;
					let dataXHi = -Infinity;
					for (const item of state.datasets) {
						if (item.kind === "card") continue;
						for (let i = 0; i < item.xs.length; i++) {
							const xv = item.xs[i];
							if (!Number.isFinite(xv)) continue;
							if (xv < dataXLo) dataXLo = xv;
							if (xv > dataXHi) dataXHi = xv;
						}
					}
					let view = null;
					if (Number.isFinite(dataXLo) && Number.isFinite(dataXHi) && dataXHi > dataXLo) {
						const currentFrame = frameById(state.frameId);
						const reverse = currentFrame !== null && currentFrame.reverseX;
						const auto = computeAutoView(next, liveOffsets(next), false);
						if (auto !== null) {
							const pad = (dataXHi - dataXLo) * 0.01;
							view = Object.assign({}, auto, reverse
								? { xLo: dataXHi + pad, xHi: dataXLo - pad }
								: { xLo: dataXLo - pad, xHi: dataXHi + pad });
						}
					}
					return Object.assign({}, state, {
						datasets: next,
						selected: made[made.length - 1].id,
						view,
						notice: null
					});
				}
				case "ADD_DERIVED": {
					const dataset = Object.assign({}, action.dataset, {
						id: nextId("ds"),
						color: action.color || nextColor(state.datasets.length),
						visible: true,
						lineWidth: 2,
						yOffset: 0,
						offsetMode: "off"
					});
					return Object.assign({}, state, {
						datasets: state.datasets.concat([dataset]),
						selected: dataset.id
					});
				}
				case "REMOVE_DATASET": {
					const datasets = state.datasets.filter((item) => item.id !== action.id);
					return Object.assign({}, state, {
						datasets,
						selected: state.selected === action.id ? (datasets.length > 0 ? datasets[datasets.length - 1].id : null) : state.selected
					});
				}
				case "PATCH_DATASET": {
					const datasets = state.datasets.map((item) =>
						item.id === action.id ? Object.assign({}, item, action.patch) : item
					);
					return Object.assign({}, state, { datasets });
				}
				case "SET_ALL_OFFSET_MODE": {
					// 卡片不参与：它的 ys 是 0~100 的相对强度，按自动堆叠会被推到谱图
					// 上方的错误位置；卡片的位置交给两条分割线（yOffset / cardHeight）。
					const mode = action.mode === "auto" || action.mode === "off" || action.mode === "manual" ? action.mode : null;
					if (mode === null) return state;
					let changed = false;
					const datasets = state.datasets.map((item) => {
						if (item.kind === "card") return item;
						if ((item.offsetMode || "auto") === mode) return item;
						changed = true;
						return Object.assign({}, item, { offsetMode: mode });
					});
					return changed ? Object.assign({}, state, { datasets }) : state;
				}
				case "SET_VIEW":
					return Object.assign({}, state, { view: action.view });
				case "PATCH_AXIS":
					return Object.assign({}, state, { axis: Object.assign({}, state.axis, action.patch) });
				case "ADD_GUIDE": {
					const guide = {
						id: nextId("g"),
						x: action.x,
						label: action.label === undefined ? "" : action.label,
						color: action.color || "#E0A030"
					};
					return Object.assign({}, state, { guides: state.guides.concat([guide]), selectedGuide: guide.id });
				}
				case "PATCH_GUIDE": {
					const guides = state.guides.map((item) => (item.id === action.id ? Object.assign({}, item, action.patch) : item));
					return Object.assign({}, state, { guides });
				}
				case "REMOVE_GUIDE":
					return Object.assign({}, state, { guides: state.guides.filter((item) => item.id !== action.id) });
				case "SET_TOOL":
					return Object.assign({}, state, { tool: action.tool });
				case "SELECT":
					return Object.assign({}, state, { selected: action.id });
				case "NOTICE":
					return withNotice(state, action.tone || "info", action.text);
				case "CLEAR_NOTICE":
					return Object.assign({}, state, { notice: null });
				case "CLEAR_ALL": {
					const frame = frameById(state.frameId);
					return Object.assign({}, state, {
						datasets: [],
						guides: [],
						view: null,
						selected: null,
						notice: null,
						axis: frame === null
							? state.axis
							: { xLabel: frame.xLabel, yLabel: frame.yLabel, reverseX: frame.reverseX, yLog: false }
					});
				}
				case "SET_DIALOG":
					return Object.assign({}, state, { dialog: action.dialog });
				default:
					return state;
			}
		}
		/* @pure-end */
		//#endregion

		//#region state — 持久化（纯：只做序列化 / 校验，localStorage 在 41-ui-plot）
		/* @pure-begin */
		const STORAGE_KEY = "dsh-sci-plot/state-v1";
		const STORAGE_VERSION = 1;

		/**
		 * 还原一条曲线。Float64Array 过不了 JSON，序列化时转数组、这里转回来；
		 * JSON 把 NaN / Infinity 写成 null，必须还原成 NaN —— 否则非有限点会
		 * 变成 0，凭空在谱图上多出一批落在基线的假数据。
		 */
		function reviveSeries(values) {
			if (values === null || values === undefined) return new Float64Array(0);
			if (typeof values !== "object") return new Float64Array(0);
			const toNumber = (value) => (value === null || value === undefined ? NaN : Number(value));
			try {
				return Float64Array.from(values, toNumber);
			} catch (error) {
				return new Float64Array(0);
			}
		}

		function serializeSeries(values) {
			if (values === null || values === undefined) return [];
			try {
				return Array.from(values, (value) => (typeof value === "number" ? value : Number(value)));
			} catch (error) {
				return [];
			}
		}

		function reviveAxis(raw) {
			const base = { xLabel: "", yLabel: "", reverseX: false, yLog: false };
			if (raw === null || typeof raw !== "object") return base;
			return {
				xLabel: typeof raw.xLabel === "string" ? raw.xLabel : "",
				yLabel: typeof raw.yLabel === "string" ? raw.yLabel : "",
				reverseX: raw.reverseX === true,
				yLog: raw.yLog === true
			};
		}

		function reviveView(raw) {
			if (raw === null || typeof raw !== "object") return null;
			const xLo = Number(raw.xLo);
			const xHi = Number(raw.xHi);
			const yLo = Number(raw.yLo);
			const yHi = Number(raw.yHi);
			if (!Number.isFinite(xLo) || !Number.isFinite(xHi) || !Number.isFinite(yLo) || !Number.isFinite(yHi)) return null;
			if (!(Math.abs(xHi - xLo) > 0) || !(Math.abs(yHi - yLo) > 0)) return null;
			return { xLo, xHi, yLo, yHi };
		}

		function reviveDataset(raw, index) {
			if (raw === null || typeof raw !== "object") return null;
			const out = {
				id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : nextId("ds"),
				name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : `曲线${index + 1}`,
				xs: reviveSeries(raw.xs),
				ys: reviveSeries(raw.ys),
				raw: null,
				color: typeof raw.color === "string" && raw.color.length > 0 ? raw.color : nextColor(index),
				visible: raw.visible !== false,
				lineWidth: Number.isFinite(raw.lineWidth) ? raw.lineWidth : 2,
				yOffset: Number.isFinite(raw.yOffset) ? raw.yOffset : 0,
				offsetMode: raw.offsetMode === "manual" || raw.offsetMode === "off" ? raw.offsetMode : "auto",
				op: raw.op !== null && typeof raw.op === "object" && typeof raw.op.label === "string" ? raw.op : null,
				source: typeof raw.source === "string" ? raw.source : null
			};
			if (raw.kind === "card") {
				out.kind = "card";
				out.cardNo = typeof raw.cardNo === "string" ? raw.cardNo : null;
				out.cardHeight = Number.isFinite(raw.cardHeight) ? raw.cardHeight : 0;
			}
			return out;
		}

		function reviveGuide(raw) {
			if (raw === null || typeof raw !== "object") return null;
			const x = Number(raw.x);
			if (!Number.isFinite(x)) return null;
			return {
				id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : nextId("g"),
				x,
				label: typeof raw.label === "string" ? raw.label : "",
				color: typeof raw.color === "string" && raw.color.length > 0 ? raw.color : "#E0A030"
			};
		}

		/**
		 * 恢复出来的 id（ds7 / cd3 / g2…）必须让 SEQ 越过去，否则下一个新建的
		 * id 会和它撞车 —— React key 重复、PATCH_DATASET 同时命中两条。
		 */
		function bumpSequence(list) {
			let max = 0;
			for (const item of list || []) {
				const match = /^[A-Za-z]+(\d+)$/.exec(String((item && item.id) || ""));
				if (match === null) continue;
				const value = Number(match[1]);
				if (Number.isFinite(value) && value > max) max = value;
			}
			if (max > SEQ) SEQ = max;
			return SEQ;
		}

		/** 校验并补齐成完整 state；任何可疑字段都退回默认值，绝不抛错。 */
		function reviveState(raw) {
			if (raw === null || typeof raw !== "object") return null;
			const datasets = [];
			if (Array.isArray(raw.datasets)) {
				for (let i = 0; i < raw.datasets.length; i++) {
					const item = reviveDataset(raw.datasets[i], i);
					if (item !== null) datasets.push(item);
				}
			}
			const guides = [];
			if (Array.isArray(raw.guides)) {
				for (const guide of raw.guides) {
					const item = reviveGuide(guide);
					if (item !== null) guides.push(item);
				}
			}
			bumpSequence(datasets);
			bumpSequence(guides);
			const frame = typeof raw.frameId === "string" ? frameById(raw.frameId) : null;
			const screen = raw.screen === "plot" && frame !== null ? "plot" : "home";
			const selected = screen === "plot" && datasets.some((item) => item.id === raw.selected) ? raw.selected : null;
			return {
				screen,
				frameId: screen === "plot" ? frame.id : null,
				datasets,
				guides,
				view: screen === "plot" ? reviveView(raw.view) : null,
				axis: reviveAxis(raw.axis),
				tool: raw.tool === "zoom" ? "zoom" : "pan",
				selected,
				selectedGuide: null,
				notice: null,
				dialog: null
			};
		}

		/**
		 * @param {object} state
		 * @param {{light?: boolean}} [options] - light：丢掉 xs / ys 只留视图与配色，
		 *   localStorage 配额不够时的降级写法。
		 */
		function serializeState(state, options) {
			const source = state === null || typeof state !== "object" ? {} : state;
			const light = !!(options && options.light);
			const datasets = Array.isArray(source.datasets) ? source.datasets : [];
			const guides = Array.isArray(source.guides) ? source.guides : [];
			const view = source.view === null || source.view === undefined ? null : {
				xLo: source.view.xLo,
				xHi: source.view.xHi,
				yLo: source.view.yLo,
				yHi: source.view.yHi
			};
			const rows = [];
			for (const item of datasets) {
				if (item === null || typeof item !== "object") continue;
				const out = {
					id: item.id,
					name: item.name,
					// raw.columns 是 xs/ys 的整份副本，存它等于把体积翻一倍。
					raw: null,
					color: item.color,
					visible: item.visible !== false,
					lineWidth: item.lineWidth,
					yOffset: item.yOffset,
					offsetMode: item.offsetMode,
					op: item.op || null,
					source: item.source || null,
					xs: light ? [] : serializeSeries(item.xs),
					ys: light ? [] : serializeSeries(item.ys)
				};
				if (item.kind === "card") {
					out.kind = "card";
					out.cardNo = item.cardNo || null;
					out.cardHeight = item.cardHeight;
				}
				rows.push(out);
			}
			return JSON.stringify({
				version: STORAGE_VERSION,
				state: {
					screen: source.screen === "plot" ? "plot" : "home",
					frameId: typeof source.frameId === "string" ? source.frameId : null,
					datasets: rows,
					guides: guides.map((guide) => ({
						id: guide && guide.id,
						x: guide && guide.x,
						label: guide && typeof guide.label === "string" ? guide.label : "",
						color: guide && guide.color
					})),
					view,
					axis: reviveAxis(source.axis),
					tool: source.tool === "zoom" ? "zoom" : "pan",
					selected: typeof source.selected === "string" ? source.selected : null
				}
			});
		}

		/** @returns {object|null} 恢复到可用 state；任何异常都回退 null 交给 initialState。 */
		function deserializeState(text) {
			if (typeof text !== "string" || text.length === 0) return null;
			let payload = null;
			try {
				payload = JSON.parse(text);
			} catch (error) {
				return null;
			}
			if (payload === null || typeof payload !== "object") return null;
			if (payload.version !== STORAGE_VERSION) return null;
			try {
				return reviveState(payload.state);
			} catch (error) {
				return null;
			}
		}
		/* @pure-end */
		//#endregion
