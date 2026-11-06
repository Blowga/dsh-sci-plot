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
