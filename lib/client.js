/**
 * dsh-sci-plot — browser half.
 *
 * 手写 `__ModuleLoader__` bundle（无构建依赖），形态照 dsh-lab-planner。
 * 注册两个 seat：
 *
 *   - `sidebar.panellist` — 侧栏行（波形 + 坐标轴字形）
 *   - `main`              — 中央面板，key = `sci-plot`
 *
 * 面板内部分两屏：卡片首页（红外 FTIR / XRD）→ 绘图页（左侧一列操作按钮 +
 * 中间 SVG 画布 + 右侧曲线/竖线/轴参数）。没有 host 端状态，全部数据活在这个
 * React 树里；需要留下的字段（screen / frameId / datasets / guides / view /
 * axis / tool / selected）由 localStorage 承接，键见 20-store 的 STORAGE_KEY。
 *
 * 本文件由 scripts/build.mjs 从 src/ 拼接生成，请改 src/ 而不是这里。
 */
window.__ModuleLoader__.load({
	id: "@blowga/dsh-sci-plot",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const h = react.createElement;

		const PLUGIN_NAME = "dsh-sci-plot";
		const PLUGIN_VERSION = "0.1.0";
		const PLUGIN_LABEL = "科研绘图";
		const PANEL_ID = "sci-plot";
		const READ_URL = "/dsh-sci-plot/read-file";

		/** 画布 viewBox：渲染坐标与鼠标坐标换算都以此为准。 */
		const VB = { w: 900, h: 560 };
		/** 绘图区内边距；右侧留给竖线标签与读数。 */
		const PAD = { left: 74, right: 128, top: 18, bottom: 58 };
		/** 轴条带宽度：落在条带内的滚轮只缩放该轴。 */
		const AXIS_BAND = { x: 46, y: 58 };

		const FONT_PLOT = "\"Times New Roman\", Times, serif";

		/** 与 origin-plot 的红外默认样式一致的低饱和五色。 */
		const PALETTE = ["#6E8B9E", "#C08B7A", "#8FA67A", "#9E8EA6", "#A69E8E"];

		const CSS = [
			".sp_root{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;",
			"background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,#e4e4ec);",
			"font-size:13px;line-height:1.6}",

			// ---------- 顶部条 ----------
			".sp_bar{display:flex;align-items:center;gap:10px;flex:0 0 auto;padding:10px 16px;",
			"border-bottom:1px solid var(--dsw-alias-border-l1,#2b2b36)}",
			".sp_crumb{display:flex;align-items:center;gap:6px;font-size:12.5px;",
			"color:var(--dsw-alias-label-secondary,#9a9aa8)}",
			".sp_crumbBtn{border:0;background:transparent;color:inherit;cursor:pointer;padding:2px 4px;",
			"border-radius:5px;font:inherit;font-size:12.5px}",
			".sp_crumbBtn:hover{color:var(--dsw-alias-label-primary,#e4e4ec);background:var(--dsw-alias-bg-layer-2,#262630)}",
			".sp_barTitle{font-weight:600;font-size:13.5px;margin-left:4px}",
			".sp_barSpacer{flex:1}",
			".sp_hint{font-size:11.5px;color:var(--dsw-alias-label-secondary,#9a9aa8)}",

			// ---------- 首页卡片 ----------
			".sp_home{flex:1;min-height:0;overflow:auto;padding:24px 28px 40px}",
			".sp_homeTitle{margin:0 0 3px;font-size:19px;font-weight:600;letter-spacing:.2px}",
			".sp_homeSub{margin:0 0 22px;font-size:12.5px;color:var(--dsw-alias-label-secondary,#9a9aa8);max-width:640px}",
			".sp_cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:14px;max-width:900px}",
			".sp_card{position:relative;display:flex;flex-direction:column;gap:8px;text-align:left;",
			"box-sizing:border-box;padding:13px 15px;border-radius:11px;cursor:pointer;font:inherit;color:inherit;",
			"border:1px solid var(--dsw-alias-border-l1,#2b2b36);background:var(--dsw-alias-bg-layer-1,#1b1b22);",
			"transition:transform .12s ease,border-color .12s ease,background .12s ease}",
			".sp_card:hover{transform:translateY(-2px);border-color:var(--dsw-alias-border-l2,#3d3d4d);",
			"background:var(--dsw-alias-bg-layer-2,#23232c)}",
			".sp_card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#3b82f6);outline-offset:2px}",
			".sp_cardHead{display:flex;align-items:center;gap:9px}",
			".sp_cardIcon{width:30px;height:30px;flex:0 0 30px;border-radius:8px;display:flex;align-items:center;",
			"justify-content:center;background:var(--dsw-alias-bg-base,transparent);",
			"border:1px solid var(--dsw-alias-border-l1,#2b2b36);color:var(--dsw-alias-brand-primary,#3b82f6)}",
			".sp_cardName{font-size:14.5px;font-weight:600}",
			".sp_cardDesc{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary,#9a9aa8);line-height:1.55}",
			".sp_badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}",
			".sp_badge{font-size:10.5px;padding:1px 6px;border-radius:20px;",
			"border:1px solid var(--dsw-alias-border-l1,#2b2b36);color:var(--dsw-alias-label-secondary,#9a9aa8)}",

			// ---------- 工作区三栏 ----------
			".sp_work{display:flex;flex:1;min-height:0}",
			".sp_tools{flex:0 0 70px;display:flex;flex-direction:column;gap:1px;padding:8px 5px 12px;overflow-y:auto;",
			"border-right:1px solid var(--dsw-alias-border-l1,#2b2b36);box-sizing:border-box}",
			".sp_tool{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px 6px;border:0;",
			"border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#9a9aa8);cursor:pointer;",
			"font:inherit;font-size:10px;line-height:1.15;letter-spacing:.2px;transition:background .1s}",
			".sp_tool:hover{background:var(--dsw-alias-bg-layer-2,#262630);color:var(--dsw-alias-label-primary,#e4e4ec)}",
			".sp_tool[data-on=\"1\"]{background:var(--dsw-alias-brand-primary,#3b82f6);color:#fff}",
			".sp_tool:disabled{opacity:.35;cursor:not-allowed}",
			".sp_toolSep{height:1px;margin:5px 6px;background:var(--dsw-alias-border-l1,#2b2b36)}",

			".sp_stage{flex:1;min-width:0;display:flex;flex-direction:column;box-sizing:border-box;padding:10px 12px 6px}",
			// ---------- 导入模式分段按钮（绘图区正上方，仅 XRD 帧） ----------
			".sp_modeRow{flex:0 0 auto;display:flex;justify-content:center;align-items:center;padding:0 0 8px}",
			".sp_modeSeg{display:inline-flex;align-items:stretch;border-radius:999px;overflow:hidden;",
			"border:1px solid var(--dsw-alias-border-l1,#2b2b36);background:var(--dsw-alias-bg-layer-1,#1b1b22)}",
			".sp_modeSeg > button{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9a9aa8);",
			"font:inherit;font-size:12px;line-height:1.35;padding:5px 18px;cursor:pointer;",
			"transition:background .12s ease,color .12s ease}",
			".sp_modeSeg > button:hover{color:var(--dsw-alias-label-primary,#e4e4ec)}",
			".sp_modeSeg > button:first-child{border-radius:999px 0 0 999px}",
			".sp_modeSeg > button:last-child{border-radius:0 999px 999px 0}",
			".sp_modeSeg > button + button{border-left:1px solid var(--dsw-alias-border-l1,#2b2b36)}",
			".sp_modeSeg > button.sp_modeSegOn{background:var(--dsw-alias-brand-primary,#3b82f6);color:#fff}",
			".sp_modeSeg > button.sp_modeSegOn:hover{color:#fff;filter:brightness(1.06)}",
			".sp_plotBox{position:relative;flex:1;min-height:0;display:flex;align-items:stretch;justify-content:center}",
			".sp_svg{display:block;width:100%;height:100%;user-select:none;-webkit-user-select:none;touch-action:none}",
			".sp_svg text{pointer-events:none}",

			// ---------- 右栏 ----------
			".sp_side{flex:0 0 272px;box-sizing:border-box;overflow-y:auto;padding:10px 12px 24px;",
			"border-left:1px solid var(--dsw-alias-border-l1,#2b2b36)}",
			".sp_sec{margin:0 0 14px}",
			".sp_secHead{display:flex;align-items:center;justify-content:space-between;margin:0 0 6px}",
			".sp_secTitle{font-size:11.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;",
			"color:var(--dsw-alias-label-secondary,#9a9aa8)}",
			".sp_row{display:flex;align-items:center;gap:6px;padding:3px 0}",
			".sp_swatch{position:relative;width:13px;height:13px;flex:0 0 13px;border-radius:3px;border:1px solid #00000033;cursor:pointer}",
			".sp_swatchMark{position:absolute;right:1px;bottom:1px;width:4px;height:4px;background:#fff;opacity:.9;",
			"clip-path:polygon(100% 0,100% 100%,0 100%)}",
			".sp_colorHidden{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;",
			"pointer-events:none}",
			".sp_dsname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;",
			"cursor:pointer}",
			".sp_dsname[data-off=\"1\"]{opacity:.42}",
			".sp_iconBtn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9a9aa8);cursor:pointer;",
			"padding:2px 3px;border-radius:4px;line-height:0}",
			".sp_iconBtn:hover{background:var(--dsw-alias-bg-layer-2,#262630);color:var(--dsw-alias-label-primary,#e4e4ec)}",
			".sp_iconBtn[data-danger=\"1\"]:hover{color:var(--dsw-alias-state-error-primary,#ef5350)}",

			".sp_rangeGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 8px;margin:4px 0 7px}",
			".sp_rangeField{display:flex;flex-direction:column;gap:2px;min-width:0}",
			".sp_rangeField > .sp_label{flex:0 0 auto;font-size:10px;letter-spacing:.1px;white-space:nowrap}",
			".sp_field{display:flex;align-items:center;gap:6px;margin:4px 0}",
			".sp_label{flex:0 0 52px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#9a9aa8)}",
			".sp_input{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1,#2b2b36);",
			"border-radius:6px;padding:3px 6px;background:var(--dsw-alias-bg-base,transparent);color:inherit;",
			"font:inherit;font-size:12px}",
			".sp_input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}",
			".sp_input::placeholder{color:var(--dsw-alias-label-secondary,#9a9aa8);opacity:.6}",
			".sp_btn{border:1px solid var(--dsw-alias-border-l1,#2b2b36);background:var(--dsw-alias-bg-layer-1,#1b1b22);",
			"color:inherit;font:inherit;font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer}",
			".sp_btn:hover{background:var(--dsw-alias-bg-layer-2,#262630)}",
			".sp_btn[data-primary=\"1\"]{background:var(--dsw-alias-brand-primary,#3b82f6);color:#fff;border-color:transparent}",
			".sp_btn[data-primary=\"1\"]:hover{filter:brightness(1.08)}",
			".sp_btn:disabled{opacity:.45;cursor:not-allowed}",
			".sp_check{display:flex;align-items:center;gap:5px;font-size:11.5px;cursor:pointer;",
			"color:var(--dsw-alias-label-secondary,#9a9aa8)}",
			".sp_check input{margin:0;accent-color:var(--dsw-alias-brand-primary,#3b82f6)}",

			// ---------- 空状态 ----------
			".sp_empty{flex:1;display:flex;align-items:center;justify-content:center;padding:24px}",
			".sp_drop{width:100%;max-width:560px;box-sizing:border-box;border:1.5px dashed var(--dsw-alias-border-l2,#3d3d4d);",
			"border-radius:14px;padding:34px 26px;text-align:center;background:var(--dsw-alias-bg-layer-1,#1b1b22)}",
			".sp_drop[data-over=\"1\"]{border-color:var(--dsw-alias-brand-primary,#3b82f6);",
			"background:var(--dsw-alias-bg-layer-2,#23232c)}",
			".sp_dropTitle{margin:0 0 6px;font-size:14.5px;font-weight:600}",
			".sp_dropSub{margin:0 0 16px;font-size:12px;color:var(--dsw-alias-label-secondary,#9a9aa8)}",
			".sp_pathRow{display:flex;gap:6px;margin-top:14px;text-align:left}",

			// ---------- 提示条 ----------
			".sp_notice{display:flex;align-items:center;gap:8px;margin:0 12px 6px;padding:6px 10px;border-radius:7px;",
			"font-size:11.5px;border:1px solid transparent}",
			".sp_notice[data-tone=\"error\"]{color:var(--dsw-alias-state-error-primary,#ef5350);",
			"border-color:var(--dsw-alias-state-error-primary,#ef5350)}",
			".sp_notice[data-tone=\"warn\"]{color:var(--dsw-alias-state-warn-primary,#e0a030);",
			"border-color:var(--dsw-alias-state-warn-primary,#e0a030)}",
			".sp_notice[data-tone=\"ok\"]{color:var(--dsw-alias-state-success-primary,#3fa76a);",
			"border-color:var(--dsw-alias-state-success-primary,#3fa76a)}",
			".sp_noticeText{flex:1;min-width:0;word-break:break-word}",

			// ---------- 浮层表单 ----------
			".sp_scrim{position:fixed;inset:0;background:#00000066;display:flex;align-items:center;",
			"justify-content:center;z-index:40;padding:20px}",
			".sp_modal{width:440px;max-width:100%;box-sizing:border-box;border-radius:12px;padding:16px 18px;",
			"background:var(--dsw-alias-bg-layer-1,#1b1b22);border:1px solid var(--dsw-alias-border-l2,#3d3d4d);",
			"box-shadow:0 18px 48px #00000066;color:inherit}",
			".sp_modalTitle{margin:0 0 12px;font-size:14px;font-weight:600}",
			".sp_modalFoot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;",
			"padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1,#2b2b36)}",
			".sp_errTxt{margin:6px 0 0;font-size:11.5px;color:var(--dsw-alias-state-error-primary,#ef5350);",
			"font-family:Consolas,ui-monospace,monospace;word-break:break-word}",
			".sp_pre{margin:6px 0 0;max-height:150px;overflow:auto;padding:8px;border-radius:6px;",
			"background:var(--dsw-alias-bg-base,#111116);border:1px solid var(--dsw-alias-border-l1,#2b2b36);",
			"font-family:Consolas,ui-monospace,monospace;font-size:11px;white-space:pre;color:var(--dsw-alias-label-secondary,#9a9aa8)}"
		].join("");
		const CSS_TAG_ID = "dsh-sci-plot/SciPlot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = PLUGIN_NAME;
			tag.dataset.pluginCss = CSS_TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#region pure — 无副作用、无 DOM、单测直接可用
		/* @pure-begin */
		const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

		/** @returns {number} NaN when the token is not a plain decimal number. */
		function num(token) {
			const text = typeof token === "string" ? token.trim() : "";
			if (text.length === 0 || text.length > 40) return NaN;
			if (!NUM_RE.test(text)) return NaN;
			const value = Number(text);
			return Number.isFinite(value) ? value : NaN;
		}

		/**
		 * Decode bytes to text. UTF-8 strictly first; a GBK fallback covers the
		 * Chinese instrument software whose headers come back as mojibake
		 * (e.g. `data/2024以及以前/test/370500-5.txt`).
		 */
		function decodeBytes(bytes) {
			const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
			if (view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) {
				return { text: safeDecode(view.subarray(3), "utf-8"), encoding: "utf-8-bom" };
			}
			if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) {
				return { text: safeDecode(view.subarray(2), "utf-16le"), encoding: "utf-16le" };
			}
			try {
				return { text: new TextDecoder("utf-8", { fatal: true }).decode(view), encoding: "utf-8" };
			} catch {
				/* fall through */
			}
			try {
				const text = new TextDecoder("gbk", { fatal: false }).decode(view);
				if (text.indexOf("\uFFFD") === -1) return { text, encoding: "gbk" };
			} catch {
				/* TextDecoder without gbk: fall through */
			}
			return { text: safeDecode(view, "utf-8"), encoding: "utf-8-lossy" };
		}

		function safeDecode(view, label) {
			try {
				return new TextDecoder(label).decode(view);
			} catch {
				return new TextDecoder("utf-8").decode(view);
			}
		}

		function splitLines(text) {
			return String(text).replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
		}

		/** Candidate separators, most specific first. */
		const DELIMS = [
			{ id: "tab", split: (line) => line.split("\t") },
			{ id: "comma", split: (line) => line.split(",") },
			{ id: "semicolon", split: (line) => line.split(";") },
			{ id: "spaces2", split: (line) => line.split(/\s{2,}/) },
			{ id: "spaces", split: (line) => line.split(/\s+/) }
		];

		/** Split one line and report whether every non-empty cell parses as a number. */
		function numericSplit(delim, line) {
			const raw = delim.split(line);
			const cells = [];
			for (const cell of raw) {
				const trimmed = cell.trim();
				if (trimmed.length === 0) continue;
				const value = num(trimmed);
				if (Number.isNaN(value)) return null;
				cells.push(value);
			}
			return cells.length >= 2 ? cells : null;
		}

		/**
		 * Neither the delimiter nor the header layout is knowable from the
		 * extension, so probe: for each candidate delimiter find the longest run
		 * of consecutive lines that split into the same number of numbers, and
		 * keep the run with the most columns (ties → longer run → earlier order).
		 */
		function detectDelimiter(lines, scanLimit) {
			const limit = Math.min(lines.length, scanLimit === undefined ? 6000 : scanLimit);
			let best = null;
			for (let d = 0; d < DELIMS.length; d++) {
				const delim = DELIMS[d];
				let runStart = -1;
				let runLen = 0;
				let runCols = 0;
				let bestRun = null;
				for (let i = 0; i <= limit; i++) {
					const line = i < limit ? lines[i] : "";
					const cells = i < limit && line.trim().length > 0 ? numericSplit(delim, line) : null;
					if (cells !== null && cells.length === runCols) {
						runLen += 1;
						continue;
					}
					if (runLen >= 3) {
						const candidate = { delim: delim.id, start: runStart, count: runLen, cols: runCols };
						if (bestRun === null || betterRun(candidate, bestRun)) bestRun = candidate;
					}
					if (cells !== null) {
						runStart = i;
						runLen = 1;
						runCols = cells.length;
					} else {
						runStart = -1;
						runLen = 0;
						runCols = 0;
					}
				}
				if (bestRun !== null && (best === null || betterRun(bestRun, best))) best = bestRun;
			}
			return best;
		}

		function betterRun(a, b) {
			if (a.cols !== b.cols) return a.cols > b.cols;
			if (a.count !== b.count) return a.count > b.count;
			return a.start < b.start;
		}

		/** Pull axis hints out of JCAMP-style (`##XUNITS=1/CM`) or plain headers. */
		function metaFromLines(lines) {
			const out = { xLabel: null, yLabel: null, title: null };
			const head = lines.slice(0, 60);
			for (const line of head) {
				const m = /^##\s*([A-Z0-9 _]+?)\s*=\s*(.+)$/i.exec(line.trim());
				if (m === null) continue;
				const key = m[1].trim().toUpperCase().replace(/\s+/g, "_");
				const value = m[2].trim();
				if (key === "TITLE") out.title = value;
				else if (key === "XUNITS") out.xLabel = axisLabelFor(value);
				else if (key === "YUNITS") out.yLabel = axisLabelFor(value);
			}
			return out;
		}

		function axisLabelFor(unit) {
			const u = String(unit).trim().toUpperCase();
			if (u === "1/CM" || u === "CM-1" || u === "CM^-1") return "Wavenumber (cm\u207B\u00B9)";
			if (u === "%T" || u === "T" || u === "TRANSMITTANCE") return "Transmittance (%)";
			if (u === "ABS" || u === "ABSORBANCE") return "Absorbance (a.u.)";
			if (u === "INTENSITY" || u === "A.U.") return "Intensity (a.u.)";
			return /^[A-Za-z0-9()\/\u00B0\u00B2\u00B3.\- ]+$/.test(String(unit).trim()) ? String(unit).trim() : null;
		}

		/**
		 * Parse a delimited text table into numeric columns.
		 *
		 * @param {string} text
		 * @param {{delimiter?: string, startLine?: number}} [override] - manual
		 *   correction after a failed probe.
		 * @returns {{ok: boolean, reason?: string, columns?: number[][],
		 *   columnNames?: (string|null)[], delimiter?: string, startLine?: number,
		 *   encoding?: string, preview?: string[], meta?: object}}
		 */
		function parseTable(text, override) {
			const lines = splitLines(text);
			const preview = [];
			for (let i = 0; i < lines.length && preview.length < 8; i++) {
				if (lines[i].trim().length > 0) preview.push(lines[i].slice(0, 200));
			}

			let delimId = override && override.delimiter;
			let startLine = override && typeof override.startLine === "number" ? override.startLine : null;
			let cols = 0;

			if (delimId === undefined) {
				const probe = detectDelimiter(lines);
				if (probe === null) {
					return { ok: false, reason: "找不到连续的数字数据行（已尝试制表符 / 逗号 / 分号 / 多空格 / 空格）", preview };
				}
				delimId = probe.delim;
				startLine = probe.start;
				cols = probe.cols;
			}

			const delim = DELIMS.find((entry) => entry.id === delimId);
			if (delim === undefined) return { ok: false, reason: `未知分隔符：${delimId}`, preview };
			if (startLine === null) return { ok: false, reason: "没有指定数据起始行，且自动探测失败", preview };

			const meta = metaFromLines(lines);
			const columns = [];
			const dataLines = [];
			const names = [];

			for (let i = startLine; i < lines.length; i++) {
				const raw = lines[i];
				const trimmed = raw.trim();
				if (trimmed.length === 0) continue;
				const cells = [];
				let bad = 0;
				for (const cell of delim.split(raw)) {
					const text2 = cell.trim();
					if (text2.length === 0) {
						cells.push(NaN);
						continue;
					}
					const value = num(text2);
					if (Number.isNaN(value)) bad += 1;
					cells.push(value);
				}
				if (bad > 0 && bad === cells.length) continue; // prose / trailer line
				if (cols > 0 && cells.length !== cols) {
					// A wider line mid-file (XPS multi-peak dump) is not this table.
					if (cells.length > cols) continue;
				}
				if (cols === 0) cols = cells.length;
				for (let c = 0; c < cols; c++) {
					if (columns[c] === undefined) columns[c] = [];
					columns[c].push(c < cells.length ? cells[c] : NaN);
				}
				dataLines.push(i);
			}

			if (cols < 2) return { ok: false, reason: `只识别出 ${cols} 列，至少需要 2 列（X 与 Y）`, preview };
			const rows = columns[0] === undefined ? 0 : columns[0].length;
			if (rows < 2) return { ok: false, reason: `数据行只有 ${rows} 行，至少需要 2 行`, preview };

			// Column names: the last non-data line above the table, split the same way.
			const headLineIndex = dataLines[0] - 1;
			let columnNames = columns.map(() => null);
			for (let i = headLineIndex; i >= Math.max(0, startLine - 40); i--) {
				const raw = lines[i];
				if (raw === undefined || raw.trim().length === 0) continue;
				const parts = delim.split(raw).map((cell) => cell.trim());
				if (parts.length === cols && parts.some((cell) => /[A-Za-z\u4e00-\u9fa5]/.test(cell))) {
					columnNames = parts;
					break;
				}
			}

			return {
				ok: true,
				columns,
				columnNames,
				delimiter: delimId,
				startLine,
				meta,
				preview,
				rows
			};
		}

		/**
		 * Cells from the start of the line that parse as numbers, stopping at the
		 * first cell that does not. A card row is `25.281 3.5200 100.0 ( 1 0 1) …`:
		 * the leading three are numbers and `( 1 0 1)` ends the run.
		 */
		function leadingNumbers(delim, line) {
			const out = [];
			for (const cell of delim.split(line)) {
				const text = cell.trim();
				if (text.length === 0) {
					if (out.length > 0) break;
					continue;
				}
				const value = num(text);
				if (Number.isNaN(value)) break;
				out.push(value);
			}
			return out;
		}

		/**
		 * Which leading number is I(f)? PDF cards are ordered
		 * `2θ d I(f) (hkl) θ 1/(2d) 2π/d n²`, so the third — unless a header line
		 * above the table names an intensity column, which wins.
		 */
		function detectCardIntensityColumn(lines, startLine, delim, leadCount) {
			const fallback = leadCount >= 3 ? 2 : 1;
			for (let i = startLine - 1; i >= Math.max(0, startLine - 40); i--) {
				const raw = lines[i];
				if (raw === undefined || raw.trim().length === 0) continue;
				const cells = delim
					.split(raw)
					.map((cell) => cell.trim())
					.filter((cell) => cell.length > 0);
				if (cells.length < 2) continue;
				for (let c = 0; c < cells.length; c++) {
					if (/^(i$|i\(|int$|intensity|强度|rel)/i.test(cells[c])) return Math.min(c, leadCount - 1);
				}
			}
			return fallback;
		}

		/**
		 * Parse an ICDD / PDF standard card.
		 *
		 * Cards carry a `( h k l)` column, so `(` and `1)` are not numbers and
		 * `parseTable` — which requires every non-empty cell of a row to be a
		 * number — rejects every single data row. Here a row qualifies as long as
		 * its *leading* run of numeric cells is at least two long; whatever follows
		 * the first non-numeric cell is ignored.
		 *
		 * @returns {{ok: boolean, xs?: Float64Array, ys?: Float64Array, rows?: number,
		 *   cardNo?: (string|null), iColumn?: number, delimiter?: string, reason?: string}}
		 */
		function parseCardTable(text) {
			const lines = splitLines(text);
			const cardMatch = /PDF[#\s]*([0-9]{2}-[0-9]{3}-[0-9]{4})/i.exec(text);
			const cardNo = cardMatch === null ? null : cardMatch[1];

			let best = null;
			for (let d = 0; d < DELIMS.length; d++) {
				const delim = DELIMS[d];
				let runStart = -1;
				let runLen = 0;
				let runLead = 0;
				let bestRun = null;
				for (let i = 0; i <= lines.length; i++) {
					const line = i < lines.length ? lines[i] : "";
					const lead = i < lines.length && line.trim().length > 0 ? leadingNumbers(delim, line) : null;
					const usable = lead !== null && lead.length >= 2;
					if (usable && lead.length === runLead) {
						runLen += 1;
						continue;
					}
					if (runLen >= 3) {
						const candidate = { delim: delim.id, start: runStart, count: runLen, cols: runLead };
						if (bestRun === null || betterRun(candidate, bestRun)) bestRun = candidate;
					}
					if (usable) {
						runStart = i;
						runLen = 1;
						runLead = lead.length;
					} else {
						runStart = -1;
						runLen = 0;
						runLead = 0;
					}
				}
				if (bestRun !== null && (best === null || betterRun(bestRun, best))) best = bestRun;
			}
			if (best === null) {
				return { ok: false, reason: "找不到连续的标准卡片行（每行需至少 2 个以数字开头的列）" };
			}

			const delim = DELIMS.find((entry) => entry.id === best.delim);
			if (delim === undefined) return { ok: false, reason: `未知分隔符：${best.delim}` };
			const iColumn = detectCardIntensityColumn(lines, best.start, delim, best.cols);

			const xs = [];
			const ys = [];
			for (let i = best.start; i < lines.length; i++) {
				const line = lines[i];
				if (line === undefined || line.trim().length === 0) continue;
				const lead = leadingNumbers(delim, line);
				if (lead.length < 2) continue;
				const x = lead[0];
				const y = iColumn < lead.length ? lead[iColumn] : lead[lead.length - 1];
				if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
				xs.push(x);
				ys.push(y);
			}
			if (xs.length < 2) return { ok: false, reason: `只找到 ${xs.length} 个峰位，至少需要 2 个` };
			return {
				ok: true,
				xs: Float64Array.from(xs),
				ys: Float64Array.from(ys),
				rows: xs.length,
				cardNo,
				iColumn,
				delimiter: best.delim
			};
		}

		//#endregion

		//#region pure — formula engine
		/* @pure-begin */
		const FORMULA_FUNCS = {
			sqrt: (v) => Math.sqrt(v),
			abs: (v) => Math.abs(v),
			ln: (v) => Math.log(v),
			log: (v) => Math.log10(v),
			log10: (v) => Math.log10(v),
			exp: (v) => Math.exp(v),
			sin: (v) => Math.sin(v),
			cos: (v) => Math.cos(v),
			tan: (v) => Math.tan(v),
			floor: (v) => Math.floor(v),
			ceil: (v) => Math.ceil(v),
			round: (v) => Math.round(v)
		};

		const FORMULA_CONSTS = { pi: Math.PI, e: Math.E };

		/**
		 * Recursive-descent formula parser. Deliberately not `eval`: the input
		 * comes from a text box and the grammar is tiny.
		 *
		 * Grammar:
		 *   expr    := term (('+'|'-') term)*
		 *   term    := unary (('*'|'/') unary)*
		 *   unary   := ('+'|'-') unary | power
		 *   power   := primary ('^' unary)?
		 *   primary := number | ident | func '(' expr ')' | '(' expr ')'
		 *
		 * @returns {{ok: true, node: object} | {ok: false, error: string, pos: number}}
		 */
		function parseFormula(source) {
			const src = String(source === undefined || source === null ? "" : source);
			let pos = 0;

			const fail = (text, at) => {
				const error = new Error(text);
				error.formulaPos = at;
				throw error;
			};
			const peek = () => (pos < src.length ? src[pos] : "");
			const skip = () => {
				while (pos < src.length && /\s/.test(src[pos])) pos += 1;
			};
			const eat = (ch) => {
				skip();
				if (peek() === ch) {
					pos += 1;
					return true;
				}
				return false;
			};

			function parseExpression() {
				let node = parseTerm();
				for (;;) {
					skip();
					const ch = peek();
					if (ch !== "+" && ch !== "-") return node;
					pos += 1;
					node = { kind: "bin", op: ch, left: node, right: parseTerm() };
				}
			}

			function parseTerm() {
				let node = parseUnary();
				for (;;) {
					skip();
					const ch = peek();
					if (ch !== "*" && ch !== "/") return node;
					pos += 1;
					node = { kind: "bin", op: ch, left: node, right: parseUnary() };
				}
			}

			function parseUnary() {
				skip();
				const ch = peek();
				if (ch === "+" || ch === "-") {
					pos += 1;
					return { kind: "neg", arg: parseUnary(), positive: ch === "+" };
				}
				return parsePower();
			}

			function parsePower() {
				const base = parsePrimary();
				skip();
				if (peek() === "^") {
					pos += 1;
					return { kind: "bin", op: "^", left: base, right: parseUnary() };
				}
				return base;
			}

			function parsePrimary() {
				skip();
				const ch = peek();
				if (ch === "(") {
					pos += 1;
					const inner = parseExpression();
					skip();
					if (!eat(")")) fail("缺少右括号", pos);
					return inner;
				}
				if (/[0-9.]/.test(ch)) {
					const start = pos;
					while (pos < src.length && /[0-9.eE]/.test(src[pos])) {
						if ((src[pos] === "e" || src[pos] === "E") && !/[0-9]/.test(src[pos + 1] || "")) {
							if (src[pos + 1] !== "-" && src[pos + 1] !== "+") break;
						}
						pos += 1;
					}
					const text = src.slice(start, pos);
					const value = num(text);
					if (Number.isNaN(value)) fail(`无法解析数字 "${text}"`, start);
					return { kind: "num", value };
				}
				const ident = readIdent();
				if (ident.length === 0) fail(ch === "" ? "公式不完整" : `无法识别的字符 "${ch}"`, pos);
				const lower = ident.toLowerCase();
				skip();
				if (peek() === "(" && Object.prototype.hasOwnProperty.call(FORMULA_FUNCS, lower)) {
					pos += 1;
					const arg = parseExpression();
					skip();
					if (!eat(")")) fail(`函数 ${lower} 缺少右括号`, pos);
					return { kind: "call", name: lower, arg };
				}
				if (Object.prototype.hasOwnProperty.call(FORMULA_CONSTS, lower)) {
					return { kind: "num", value: FORMULA_CONSTS[lower] };
				}
				if (lower === "x" || lower === "y" || /^col\d{1,3}$/.test(lower) || /^f$/.test(lower)) {
					return { kind: "var", name: lower };
				}
				fail(`未知变量 "${ident}"（可用 x、y、col1…col99）`, pos);
				return { kind: "num", value: 0 };
			}

			function readIdent() {
				const start = pos;
				while (pos < src.length && /[A-Za-z0-9_]/.test(src[pos])) pos += 1;
				return src.slice(start, pos);
			}

			try {
				const root = parseExpression();
				skip();
				if (pos < src.length) fail(`多余的字符 "${src.slice(pos, pos + 8)}"`, pos);
				return { ok: true, node: root };
			} catch (error) {
				if (error && error.formulaPos !== undefined) return { ok: false, error: error.message, pos: error.formulaPos };
				return { ok: false, error: error instanceof Error ? error.message : String(error), pos };
			}
		}

		/** Evaluate a parsed node; `scope(name)` returns a number or undefined. */
		function evalNode(node, scope) {
			switch (node.kind) {
				case "num":
					return node.value;
				case "var": {
					const value = scope(node.name);
					return typeof value === "number" ? value : NaN;
				}
				case "neg": {
					const value = evalNode(node.arg, scope);
					return node.positive ? value : -value;
				}
				case "bin": {
					const a = evalNode(node.left, scope);
					const b = evalNode(node.right, scope);
					if (node.op === "+") return a + b;
					if (node.op === "-") return a - b;
					if (node.op === "*") return a * b;
					if (node.op === "/") return b === 0 ? NaN : a / b;
					return Math.pow(a, b);
				}
				case "call": {
					const value = evalNode(node.arg, scope);
					const fn = FORMULA_FUNCS[node.name];
					return typeof fn === "function" ? fn(value) : NaN;
				}
				default:
					return NaN;
			}
		}
		//#endregion

		//#region pure — scales and geometry
		/* @pure-begin */
		function niceStep(span, target) {
			const count = Math.max(2, target || 6);
			const raw = Math.abs(span) / count;
			if (!(raw > 0) || !Number.isFinite(raw)) return 1;
			const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
			const norm = raw / magnitude;
			let mult = 10;
			if (norm <= 1.0000001) mult = 1;
			else if (norm <= 2.0000001) mult = 2;
			else if (norm <= 5.0000001) mult = 5;
			return mult * magnitude;
		}

		function roundToStep(value, step) {
			if (!(step > 0)) return value;
			const digits = Math.max(0, Math.min(15, -Math.floor(Math.log10(step)) + 1));
			return Number(value.toFixed(digits));
		}

		/**
		 * Tick values covering [min, max], including reversed axes (min > max).
		 *
		 * @returns {{lo: number, hi: number, step: number, ticks: number[], minor: number[]}}
		 */
		function niceTicks(min, max, target) {
			const lo = Math.min(min, max);
			const hi = Math.max(min, max);
			if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1, step: 1, ticks: [0, 1], minor: [] };
			if (hi - lo === 0) {
				const step0 = Math.abs(hi) > 0 ? Math.abs(hi) * 0.1 : 1;
				return { lo: hi - step0, hi: hi + step0, step: step0, ticks: [hi - step0, hi, hi + step0], minor: [] };
			}
			const step = niceStep(hi - lo, target);
			const first = Math.ceil(lo / step - 1e-9) * step;
			const ticks = [];
			for (let i = 0; i < 500; i++) {
				const value = roundToStep(first + i * step, step);
				if (value > hi + step * 1e-6) break;
				ticks.push(value);
			}
			if (ticks.length === 0) ticks.push(roundToStep(lo, step), roundToStep(hi, step));
			const minorStep = step / 5;
			const minor = [];
			for (let i = 0; i < 2500; i++) {
				const value = roundToStep(lo + i * minorStep, minorStep);
				if (value > hi + minorStep * 1e-6) break;
				if (Math.abs(value / step - Math.round(value / step)) > 1e-6) minor.push(value);
			}
			return { lo, hi, step, ticks, minor };
		}

		/** 3.5 → "3.5", 0.30000000000000004 → "0.3". */
		function formatTick(value, step) {
			if (value === 0) return "0";
			const abs = Math.abs(value);
			if (abs >= 1e5 || abs < 1e-3) {
				return value.toExponential(1).replace(/\.0e/, "e").replace("e+", "e");
			}
			const digits = Math.max(0, Math.min(6, -Math.floor(Math.log10(Math.abs(step))) ));
			return String(Number(value.toFixed(digits)));
		}

		function finiteNumbers(values) {
			let lo = Infinity;
			let hi = -Infinity;
			for (let i = 0; i < values.length; i++) {
				const v = values[i];
				if (!Number.isFinite(v)) continue;
				if (v < lo) lo = v;
				if (v > hi) hi = v;
			}
			return lo <= hi ? { lo, hi } : { lo: 0, hi: 1 };
		}

		/**
		 * origin-plot's IR stacking rule, reproduced literally:
		 *   gap = 0.08 × largest span across series (a fixed step would be eaten
		 *   by the baseline differences between samples)
		 *   offset[0] = 0
		 *   offset[k] = offset[k-1] + maxY[k-1] − minY[k] + gap
		 *
		 * @param {{ys: ArrayLike<number>}[]} series - in display order.
		 * @returns {number[]} one offset per series.
		 */
		function computeOffsets(series, gapRatio) {
			const ratio = typeof gapRatio === "number" ? gapRatio : 0.08;
			if (!Array.isArray(series) || series.length === 0) return [];
			const spans = series.map((item) => {
				const range = finiteNumbers(item.ys);
				return range.hi - range.lo;
			});
			const maxSpan = Math.max.apply(null, spans.concat([0]));
			const gap = maxSpan * ratio;
			const offsets = [0];
			for (let i = 1; i < series.length; i++) {
				const prev = finiteNumbers(series[i - 1].ys);
				const current = finiteNumbers(series[i].ys);
				offsets.push(offsets[i - 1] + prev.hi - current.lo + gap);
			}
			return offsets;
		}

		/**
		 * Central difference with one-sided ends. Works on a descending X too:
		 * the numerator and denominator change sign together, so the slope keeps
		 * its physical sign without reversing the array.
		 */
		function differentiate(xs, ys) {
			const n = Math.min(xs.length, ys.length);
			const out = new Float64Array(n);
			if (n < 2) return out;
			for (let i = 1; i < n - 1; i++) {
				const dx = xs[i + 1] - xs[i - 1];
				out[i] = dx === 0 ? NaN : (ys[i + 1] - ys[i - 1]) / dx;
			}
			const dx0 = xs[1] - xs[0];
			out[0] = dx0 === 0 ? NaN : (ys[1] - ys[0]) / dx0;
			const dxn = xs[n - 1] - xs[n - 2];
			out[n - 1] = dxn === 0 ? NaN : (ys[n - 1] - ys[n - 2]) / dxn;
			return out;
		}

		/**
		 * Value of a series at an arbitrary X, for readouts under the crosshair
		 * and the guide line. Finds the nearest sample, then interpolates against
		 * the closer neighbour — monotone data is exact, and a CV sweep (which is
		 * not a function of X) degrades to the nearest sample instead of lying.
		 */
		function valueAt(xs, ys, x) {
			const n = Math.min(xs.length, ys.length);
			if (n === 0) return { y: NaN, index: -1, exact: false };
			let best = -1;
			let bestDist = Infinity;
			for (let i = 0; i < n; i++) {
				const d = Math.abs(xs[i] - x);
				if (d < bestDist) {
					bestDist = d;
					best = i;
				}
			}
			if (best < 0) return { y: NaN, index: -1, exact: false };
			if (bestDist === 0) return { y: ys[best], index: best, exact: true };
			const left = best > 0 ? best - 1 : best;
			const right = best < n - 1 ? best + 1 : best;
			for (const pair of [
				[left, best],
				[best, right]
			]) {
				const a = pair[0];
				const b = pair[1];
				if (a === b) continue;
				const xa = xs[a];
				const xb = xs[b];
				if (!(xa <= x && x <= xb) && !(xb <= x && x <= xa)) continue;
				if (xa === xb) continue;
				const t = (x - xa) / (xb - xa);
				return { y: ys[a] + (ys[b] - ys[a]) * t, index: best, exact: false };
			}
			return { y: ys[best], index: best, exact: false };
		}

		/**
		 * Reduce a polyline to at most ~2 points per pixel bucket while keeping
		 * the bucket's min and max — a peak must never be shaved off by sampling.
		 * Buckets follow index order, so non-monotone X (a CV sweep) stays intact.
		 *
		 * @returns {{i: number, px: number, py: number}[]}
		 */
		function decimate(xs, ys, mapPoint, buckets) {
			const n = Math.min(xs.length, ys.length);
			const target = Math.max(64, Math.floor(buckets || 900));
			const points = [];
			for (let i = 0; i < n; i++) {
				const y = ys[i];
				const mapped = mapPoint(xs[i], y, i);
				if (mapped === null) continue;
				points.push({ i, px: mapped[0], py: mapped[1] });
			}
			if (points.length <= target * 2) return points;
			const size = Math.ceil(points.length / target);
			const out = [points[0]];
			for (let start = 0; start < points.length; start += size) {
				const end = Math.min(points.length, start + size);
				let minIdx = -1;
				let maxIdx = -1;
				let minY = Infinity;
				let maxY = -Infinity;
				for (let k = start; k < end; k++) {
					const p = points[k];
					if (p.py < minY) {
						minY = p.py;
						minIdx = k;
					}
					if (p.py > maxY) {
						maxY = p.py;
						maxIdx = k;
					}
				}
				for (const idx of [minIdx, maxIdx].sort((a, b) => a - b)) {
					if (idx >= 0 && out[out.length - 1] !== points[idx]) out.push(points[idx]);
				}
			}
			const last = points[points.length - 1];
			if (out[out.length - 1] !== last) out.push(last);
			return out;
		}

		function pointsToPath(points) {
			if (points.length === 0) return "";
			const parts = ["M", fmt(points[0].px), fmt(points[0].py)];
			for (let i = 1; i < points.length; i++) parts.push("L", fmt(points[i].px), fmt(points[i].py));
			return parts.join(" ");
		}

		function fmt(value) {
			return String(Math.round(value * 100) / 100);
		}
		//#endregion

		//#region pure — series helpers used by the UI
		/* @pure-begin */
		function clamp(value, lo, hi) {
			return value < lo ? lo : value > hi ? hi : value;
		}

		function displayName(fileName) {
			return String(fileName || "未命名").replace(/\.(txt|csv|dat|dpt|tsv|asc|xy|prn)$/i, "");
		}

		function nextColor(index) {
			if (index < PALETTE.length) return PALETTE[index];
			const hue = (index * 47 + 200) % 360;
			return hslToHex(hue, 0.18, 0.55);
		}

		function hslToHex(hue, saturation, lightness) {
			const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
			const hp = (hue % 360) / 60;
			const x = c * (1 - Math.abs((hp % 2) - 1));
			let r = 0;
			let g = 0;
			let b = 0;
			if (hp < 1) [r, g, b] = [c, x, 0];
			else if (hp < 2) [r, g, b] = [x, c, 0];
			else if (hp < 3) [r, g, b] = [0, c, x];
			else if (hp < 4) [r, g, b] = [0, x, c];
			else if (hp < 5) [r, g, b] = [x, 0, c];
			else [r, g, b] = [c, 0, x];
			const m = lightness - c / 2;
			const to = (v) =>
				Math.round(clamp(v + m, 0, 1) * 255)
					.toString(16)
					.padStart(2, "0");
			return `#${to(r)}${to(g)}${to(b)}`;
		}

		/** `colN` for a 1-based column index. */
		function colVar(index) {
			return `col${index + 1}`;
		}

		/**
		 * 原生 `<input type="color">` 的 value 只接受 `#rrggbb`（三位缩写与
		 * rgb()/hsl() 都会被浏览器当成非法值吞掉），所以取色器开口前先归一化，
		 * 不认识就退回默认色，保证 input 永远拿到合法值。
		 */
		function colorInputValue(color, fallback) {
			const text = typeof color === "string" ? color.trim() : "";
			const six = /^#([0-9a-fA-F]{6})$/.exec(text);
			if (six !== null) return `#${six[1].toLowerCase()}`;
			const three = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(text);
			if (three !== null) return `#${three[1]}${three[1]}${three[2]}${three[2]}${three[3]}${three[3]}`.toLowerCase();
			return fallback || PALETTE[0];
		}
		//#endregion
		/* @pure-end */
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

		/**
		 * A standard card is a stick pattern, not a polyline. Drawing it as one path
		 * would join peak n to peak n+1 with a diagonal across the whole range, so
		 * each peak becomes its own vertical bar: baseline → scaled intensity.
		 * `height` is the Y-units the card's strongest peak should occupy.
		 */
		function cardSticks(dataset, base, scales, height) {
			const xs = dataset.xs;
			const ys = dataset.ys;
			let maxY = 0;
			for (let i = 0; i < ys.length; i++) {
				if (Number.isFinite(ys[i]) && ys[i] > maxY) maxY = ys[i];
			}
			if (!(maxY > 0) || !(height > 0)) return [];
			const shift = Number.isFinite(base) ? base : 0;
			const pyBase = scales.sy(shift);
			if (!Number.isFinite(pyBase)) return [];
			const out = [];
			for (let i = 0; i < xs.length; i++) {
				const x = xs[i];
				const raw = ys[i];
				if (!Number.isFinite(x) || !Number.isFinite(raw) || raw <= 0) continue;
				const px = scales.sx(x);
				const pyTop = scales.sy(shift + (raw / maxY) * height);
				if (!Number.isFinite(px) || !Number.isFinite(pyTop)) continue;
				out.push({ key: `${dataset.id}-${i}`, px, pyTop, pyBase });
			}
			return out;
		}

		/**
		 * 卡片的两条水平分割线：下线 = 基线（yOffset），上线 = 基线 + cardHeight。
		 * 返回像素坐标；任一映射不出来（例如 Y 轴取对数而基线 ≤ 0）时返回 null，
		 * 此时不画线 —— 画不出来就没法拖。
		 */
		function cardSplitGeometry(offset, height, scales) {
			const base = Number.isFinite(offset) ? offset : 0;
			const tall = Number.isFinite(height) ? height : 0;
			const pyBase = scales.sy(base);
			const pyTop = scales.sy(base + tall);
			if (!Number.isFinite(pyBase) || !Number.isFinite(pyTop)) return null;
			return { pyBase, pyTop };
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
						const offset = offsets[index] || 0;
						const selected = state.selected === item.id;
						if (item.kind === "card") {
							const sticks = cardSticks(item, offset, scales, item.cardHeight || 0);
							const nodes = [
								h(
									"g",
									{ key: "sticks", "data-sticks": "1" },
									sticks.map((stick) =>
										h("line", {
											key: stick.key,
											"data-stick": "1",
											x1: stick.px,
											y1: stick.pyBase,
											x2: stick.px,
											y2: stick.pyTop,
											stroke: item.color,
											strokeWidth: selected ? (item.lineWidth || 2) + 0.4 : item.lineWidth || 2,
											strokeLinecap: "butt",
											opacity: selected ? 1 : 0.92
										})
									)
								)
							];
							// 两条分割线是「视觉分隔」，导出时要保留 —— 因此不带
							// data-interactive（serializeSvg 会剥掉那个属性所在的组），
							// 命中判定在 bindStageEvents 里按几何位置另做。
							const split = cardSplitGeometry(offset, item.cardHeight || 0, scales);
							if (split !== null) {
								const lineStyle = {
									x1: box.left,
									x2: box.left + box.width,
									stroke: item.color,
									strokeWidth: 1,
									strokeDasharray: "5 4",
									opacity: 0.72
								};
								nodes.push(
									h("line", Object.assign({ key: "split-bottom", "data-split": "bottom", y1: split.pyBase, y2: split.pyBase }, lineStyle))
								);
								nodes.push(
									h("line", Object.assign({ key: "split-top", "data-split": "top", y1: split.pyTop, y2: split.pyTop }, lineStyle))
								);
							}
							return h("g", { key: item.id, "data-card": item.id }, nodes);
						}
						const path = curvePath(item, offset, scales);
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
		//#region render — interaction
		const SVG_NS = "http://www.w3.org/2000/svg";

		function toLocal(svg, evt) {
			try {
				const point = svg.createSVGPoint();
				point.x = evt.clientX;
				point.y = evt.clientY;
				const matrix = svg.getScreenCTM();
				if (!matrix) return { px: 0, py: 0 };
				const mapped = point.matrixTransform(matrix.inverse());
				return { px: mapped.x, py: mapped.y };
			} catch (error) {
				return { px: 0, py: 0 };
			}
		}

		function hitGuide(px, view, axis, guides) {
			if (!guides || guides.length === 0) return null;
			const scales = makeScales(view, axis);
			let best = null;
			let bestDistance = 9;
			for (const guide of guides) {
				const distance = Math.abs(scales.sx(guide.x) - px);
				if (distance < bestDistance) {
					bestDistance = distance;
					best = guide.id;
				}
			}
			return best;
		}

		/** 分割线命中容差（像素）：线本身只有 1px，上下 ±5 都算命中。 */
		const SPLIT_HIT_TOLERANCE = 5;
		/** 拖上线时与下线保留的最小像素间隔，免两条线叠在一起后点不中。 */
		const SPLIT_MIN_GAP = 6;

		/**
		 * 哪条卡片分割线被指到了。分割线没有 data-interactive（导出要留着它们），
		 * 所以命中靠几何位置算，不靠 DOM 事件。
		 *
		 * @returns {null | {id: string, edge: "bottom"|"top", pyBase: number,
		 *   pyTop: number, offset: number}}
		 */
		function hitCardSplit(px, py, view, axis, datasets, offsets) {
			const box = plotBox();
			if (px < box.left || px > box.left + box.width) return null;
			if (py < box.top || py > box.top + box.height) return null;
			const scales = makeScales(view, axis);
			const list = datasets || [];
			let best = null;
			let bestDistance = SPLIT_HIT_TOLERANCE;
			for (let i = 0; i < list.length; i++) {
				const item = list[i];
				if (item === null || typeof item !== "object") continue;
				if (item.kind !== "card" || item.visible === false) continue;
				const offset = (offsets && offsets[i]) || 0;
				const split = cardSplitGeometry(offset, item.cardHeight || 0, scales);
				if (split === null) continue;
				const hit = { id: item.id, edge: "bottom", pyBase: split.pyBase, pyTop: split.pyTop, offset };
				const bottomDistance = Math.abs(split.pyBase - py);
				if (bottomDistance <= bestDistance) {
					bestDistance = bottomDistance;
					best = hit;
				}
				const topDistance = Math.abs(split.pyTop - py);
				if (topDistance < bestDistance) {
					bestDistance = topDistance;
					best = Object.assign({}, hit, { edge: "top" });
				}
			}
			return best;
		}

		function bindStageEvents(svg, svgRef, stateRef, offsetsRef, viewRef, dispatch) {
			let mode = null;
			let guideId = null;
			let startPx = 0;
			let startPy = 0;
			let startView = null;
			let splitId = null;
			let splitEdge = null;
			let splitStartPy = 0;
			let splitBasePy = NaN;
			let splitTopPy = NaN;
			let splitValue = 0;
			let splitGroup = null;

			const onWheel = (event) => {
				const state = stateRef.current;
				const view = viewRef.current;
				const box = plotBox();
				const local = toLocal(svg, event);
				const inPlot =
					local.px >= box.left &&
					local.px <= box.left + box.width &&
					local.py >= box.top &&
					local.py <= box.top + box.height;
				const inXBand = local.py > box.top + box.height && local.py <= VB.h - 2;
				const inYBand = local.px < box.left && local.px >= 2;
				if (!inPlot && !inXBand && !inYBand) return;
				event.preventDefault();
				const scales = makeScales(view, state.axis);
				const factor = event.deltaY > 0 ? 1.18 : 1 / 1.18;
				const next = Object.assign({}, view);
				const doX = inPlot || inXBand;
				const doY = inPlot || inYBand;
				if (doX) {
					const anchor = scales.ix(clamp(local.px, box.left, box.left + box.width));
					next.xLo = anchor + (view.xLo - anchor) * factor;
					next.xHi = anchor + (view.xHi - anchor) * factor;
				}
				if (doY) {
					const anchor = scales.iy(clamp(local.py, box.top, box.top + box.height));
					next.yLo = anchor + (view.yLo - anchor) * factor;
					next.yHi = anchor + (view.yHi - anchor) * factor;
				}
				dispatch({ type: "SET_VIEW", view: next });
			};

			const onDown = (event) => {
				if (event.button !== 0) return;
				const state = stateRef.current;
				const view = viewRef.current;
				const box = plotBox();
				const local = toLocal(svg, event);
				if (
					local.px < box.left ||
					local.px > box.left + box.width ||
					local.py < box.top ||
					local.py > box.top + box.height
				) {
					return;
				}
				const split = hitCardSplit(local.px, local.py, view, state.axis, state.datasets, offsetsRef.current);
				if (split !== null) {
					// 分割线优先于平移 / 框选 / 竖线：抓住就先吃掉这次按下，
					// preventDefault 让后面的 pan 分支不再被触发。
					mode = "cardSplit";
					splitId = split.id;
					splitEdge = split.edge;
					splitStartPy = local.py;
					splitBasePy = split.pyBase;
					splitTopPy = split.pyTop;
					splitValue = split.offset;
					splitGroup = svg.querySelector(`[data-card="${split.id}"]`);
					svg.setPointerCapture(event.pointerId);
					svg.style.cursor = "ns-resize";
					event.preventDefault();
					return;
				}
				const target = hitGuide(local.px, view, state.axis, state.guides);
				if (target !== null) {
					mode = "guide";
					guideId = target;
					svg.setPointerCapture(event.pointerId);
					svg.style.cursor = "ew-resize";
					event.preventDefault();
					return;
				}
				if (state.tool === "zoom") {
					mode = "box";
					startPx = local.px;
					startPy = local.py;
					svg.setPointerCapture(event.pointerId);
					event.preventDefault();
					return;
				}
				mode = "pan";
				startPx = local.px;
				startPy = local.py;
				startView = Object.assign({}, view);
				svg.setPointerCapture(event.pointerId);
				svg.style.cursor = "grabbing";
				event.preventDefault();
			};

			const onMove = (event) => {
				const state = stateRef.current;
				const view = viewRef.current;
				const box = plotBox();
				const local = toLocal(svg, event);

				if (mode === "cardSplit" && splitId !== null) {
					if (splitGroup === null) return;
					if (splitEdge === "bottom") {
						// 下线 = 基线：整张卡片（竖线 + 两条线）一起平移，所以直接挪组。
						const py = clamp(local.py, box.top, box.top + box.height);
						splitGroup.setAttribute("transform", `translate(0 ${fmt(py - splitStartPy)})`);
						return;
					}
					// 上线 = 顶部：底线不动，只改高度。竖线组以基线为原点做 Y 缩放。
					const py = Math.max(Math.min(local.py, splitBasePy - SPLIT_MIN_GAP), box.top);
					const topLine = splitGroup.querySelector('[data-split="top"]');
					if (topLine) {
						topLine.setAttribute("y1", String(py));
						topLine.setAttribute("y2", String(py));
					}
					const sticks = splitGroup.querySelector("[data-sticks]");
					const span = splitBasePy - splitTopPy;
					if (sticks && span > 0) {
						const k = Math.round(((splitBasePy - py) / span) * 10000) / 10000;
						sticks.setAttribute(
							"transform",
							`translate(0 ${splitBasePy}) scale(1 ${k}) translate(0 ${-splitBasePy})`
						);
					}
					return;
				}

				if (mode === "pan" && startView !== null) {
					const dx = ((local.px - startPx) / box.width) * (startView.xHi - startView.xLo);
					const dy = ((local.py - startPy) / box.height) * (startView.yHi - startView.yLo);
					dispatch({
						type: "SET_VIEW",
						view: {
							xLo: startView.xLo - dx,
							xHi: startView.xHi - dx,
							yLo: startView.yLo + dy,
							yHi: startView.yHi + dy
						}
					});
					return;
				}

				if (mode === "guide" && guideId !== null) {
					const px = clamp(local.px, box.left, box.left + box.width);
					const group = svg.querySelector(`[data-guide="${guideId}"]`);
					if (group) {
						const line = group.querySelector("line");
						const rect = group.querySelector("rect");
						const label = group.querySelector("[data-guide-label]");
						if (line) {
							line.setAttribute("x1", String(px));
							line.setAttribute("x2", String(px));
						}
						if (rect) rect.setAttribute("x", String(px - 30));
						if (label) {
							const scales = makeScales(view, state.axis);
							label.setAttribute("x", String(px));
							label.textContent = fmt(scales.ix(px));
						}
					}
					return;
				}

				if (mode === "box") {
					const group = svg.querySelector("[data-box-zoom]");
					const rect = group ? group.querySelector("[data-box-rect]") : null;
					if (group && rect) {
						group.setAttribute("opacity", "1");
						const x = Math.min(startPx, local.px);
						const y = Math.min(startPy, local.py);
						rect.setAttribute("x", String(x));
						rect.setAttribute("y", String(y));
						rect.setAttribute("width", String(Math.abs(local.px - startPx)));
						rect.setAttribute("height", String(Math.abs(local.py - startPy)));
					}
					return;
				}

				const hoverSplit = hitCardSplit(local.px, local.py, view, state.axis, state.datasets, offsetsRef.current);
				svg.style.cursor = hoverSplit === null ? "" : "ns-resize";
				updateCross(svg, state, view, offsetsRef.current, local, box);
			};

			const onUp = (event) => {
				const state = stateRef.current;
				const view = viewRef.current;
				const box = plotBox();
				const local = toLocal(svg, event);

				if (mode === "cardSplit" && splitId !== null) {
					if (splitGroup !== null) {
						// 松手前把拖动期的临时几何清掉，再写回 state；两条线由 React
						// 按新值重画，不清会留下一次手动 setAttribute 的残影。
						splitGroup.removeAttribute("transform");
						const sticks = splitGroup.querySelector("[data-sticks]");
						if (sticks) sticks.removeAttribute("transform");
						const topLine = splitGroup.querySelector('[data-split="top"]');
						if (topLine && Number.isFinite(splitTopPy)) {
							topLine.setAttribute("y1", String(splitTopPy));
							topLine.setAttribute("y2", String(splitTopPy));
						}
					}
					const scales = makeScales(view, state.axis);
					if (splitEdge === "bottom") {
						const py = clamp(local.py, box.top, box.top + box.height);
						const value = scales.iy(py);
						if (Number.isFinite(value)) {
							dispatch({ type: "PATCH_DATASET", id: splitId, patch: { yOffset: value, offsetMode: "manual" } });
						}
					} else {
						const py = Math.max(Math.min(local.py, splitBasePy - SPLIT_MIN_GAP), box.top);
						const height = scales.iy(py) - splitValue;
						if (Number.isFinite(height) && height > 0) {
							dispatch({ type: "PATCH_DATASET", id: splitId, patch: { cardHeight: height } });
						}
					}
				} else if (mode === "guide" && guideId !== null) {
					const scales = makeScales(view, state.axis);
					const px = clamp(local.px, box.left, box.left + box.width);
					dispatch({ type: "PATCH_GUIDE", id: guideId, patch: { x: scales.ix(px) } });
				} else if (mode === "box") {
					const group = svg.querySelector("[data-box-zoom]");
					if (group) group.setAttribute("opacity", "0");
					const width = Math.abs(local.px - startPx);
					const height = Math.abs(local.py - startPy);
					if (width > 6 && height > 6) {
						const scales = makeScales(view, state.axis);
						const xa = scales.ix(clamp(startPx, box.left, box.left + box.width));
						const xb = scales.ix(clamp(local.px, box.left, box.left + box.width));
						const ya = scales.iy(clamp(startPy, box.top, box.top + box.height));
						const yb = scales.iy(clamp(local.py, box.top, box.top + box.height));
						const reversed = view.xLo > view.xHi;
						dispatch({
							type: "SET_VIEW",
							view: {
								xLo: reversed ? Math.max(xa, xb) : Math.min(xa, xb),
								xHi: reversed ? Math.min(xa, xb) : Math.max(xa, xb),
								yLo: Math.min(ya, yb),
								yHi: Math.max(ya, yb)
							}
						});
					}
				}

				mode = null;
				guideId = null;
				startView = null;
				splitId = null;
				splitEdge = null;
				splitGroup = null;
				splitBasePy = NaN;
				splitTopPy = NaN;
				splitValue = 0;
				svg.style.cursor = "";
				try {
					svg.releasePointerCapture(event.pointerId);
				} catch (error) {
					/* pointer already released */
				}
			};

			const onLeave = () => {
				const cross = svg.querySelector("[data-cross]");
				if (cross) cross.setAttribute("opacity", "0");
				if (mode === null) svg.style.cursor = "";
			};

			const onDoubleClick = () => {
				dispatch({ type: "SET_VIEW", view: null });
			};

			const onContextMenu = (event) => {
				const state = stateRef.current;
				const view = viewRef.current;
				const box = plotBox();
				const local = toLocal(svg, event);
				if (local.px < box.left || local.px > box.left + box.width) return;
				if (local.py < box.top || local.py > box.top + box.height) return;
				event.preventDefault();
				const scales = makeScales(view, state.axis);
				dispatch({ type: "ADD_GUIDE", x: scales.ix(local.px) });
			};

			svg.addEventListener("wheel", onWheel, { passive: false });
			svg.addEventListener("pointerdown", onDown);
			svg.addEventListener("pointermove", onMove);
			svg.addEventListener("pointerup", onUp);
			svg.addEventListener("pointercancel", onUp);
			svg.addEventListener("pointerleave", onLeave);
			svg.addEventListener("dblclick", onDoubleClick);
			svg.addEventListener("contextmenu", onContextMenu);

			return () => {
				svg.removeEventListener("wheel", onWheel);
				svg.removeEventListener("pointerdown", onDown);
				svg.removeEventListener("pointermove", onMove);
				svg.removeEventListener("pointerup", onUp);
				svg.removeEventListener("pointercancel", onUp);
				svg.removeEventListener("pointerleave", onLeave);
				svg.removeEventListener("dblclick", onDoubleClick);
				svg.removeEventListener("contextmenu", onContextMenu);
			};
		}

		function updateCross(svg, state, view, offsets, local, box) {
			const group = svg.querySelector("[data-cross]");
			if (!group) return;
			const inside =
				local.px >= box.left &&
				local.px <= box.left + box.width &&
				local.py >= box.top &&
				local.py <= box.top + box.height;
			if (!inside) {
				group.setAttribute("opacity", "0");
				return;
			}
			group.setAttribute("opacity", "1");
			const scales = makeScales(view, state.axis);
			const dataX = scales.ix(local.px);
			const lineV = group.querySelector("[data-cross-v]");
			const lineH = group.querySelector("[data-cross-h]");
			if (lineV) {
				lineV.setAttribute("x1", String(local.px));
				lineV.setAttribute("x2", String(local.px));
			}
			if (lineH) {
				lineH.setAttribute("y1", String(local.py));
				lineH.setAttribute("y2", String(local.py));
			}

			const dots = group.querySelector("[data-cross-dots]");
			if (dots) {
				while (dots.firstChild) dots.removeChild(dots.firstChild);
				const list = visibleList(state.datasets);
				let index = 0;
				for (const item of state.datasets) {
					const offset = offsets[index] || 0;
					index += 1;
					if (item.visible === false) continue;
					if (item.kind === "card") continue; // 卡片是离散峰，插值读数没有意义
					const read = valueAt(item.xs, item.ys, dataX);
					if (!Number.isFinite(read.y)) continue;
					const py = scales.sy(read.y + offset);
					if (!Number.isFinite(py)) continue;
					const dot = document.createElementNS(SVG_NS, "circle");
					dot.setAttribute("cx", String(local.px));
					dot.setAttribute("cy", String(py));
					dot.setAttribute("r", "3");
					dot.setAttribute("fill", item.color);
					dot.setAttribute("stroke", "#ffffff");
					dot.setAttribute("stroke-width", "1");
					dots.appendChild(dot);
				}
				if (list.length === 0) {
					/* nothing to mark */
				}
			}

			const tip = group.querySelector("[data-cross-tip]");
			const tipBg = group.querySelector("[data-cross-tip-bg]");
			const tipText = group.querySelector("[data-cross-tip-text]");
			if (!tip || !tipBg || !tipText) return;
			const lines = [`X = ${fmt(dataX)}`];
			for (const item of state.datasets) {
				if (item.visible === false) continue;
				if (item.kind === "card") continue; // 卡片是离散峰，插值读数没有意义
				const read = valueAt(item.xs, item.ys, dataX);
				if (!Number.isFinite(read.y)) continue;
				lines.push(`${item.name}: ${fmt(read.y)}`);
			}
			const width = Math.max(96, Math.min(240, lines.reduce((max, line) => Math.max(max, line.length * 6.6), 0) + 16));
			const height = 8 + lines.length * 14;
			const rawX = local.px + 14;
			const tipX = rawX + width > VB.w - 4 ? local.px - 14 - width : rawX;
			const tipY = Math.min(local.py + 14, VB.h - 4 - height);
			tip.setAttribute("transform", `translate(${fmt(tipX)} ${fmt(tipY)})`);
			tipBg.setAttribute("width", String(width));
			tipBg.setAttribute("height", String(height));
			while (tipText.firstChild) tipText.removeChild(tipText.firstChild);
			lines.forEach((line, index) => {
				const tspan = document.createElementNS(SVG_NS, "tspan");
				tspan.setAttribute("x", "8");
				tspan.setAttribute("y", String(14 + index * 14));
				tspan.textContent = line;
				tipText.appendChild(tspan);
			});
		}
		//#endregion

		//#region render — export
		function inlineVariables(root) {
			const nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
			for (const node of nodes) {
				for (const attribute of ["fill", "stroke"]) {
					const value = node.getAttribute(attribute);
					if (!value || value.indexOf("var(") !== 0) continue;
					const match = /var\(\s*[^,]+,\s*([^)]+)\)/.exec(value);
					node.setAttribute(attribute, match ? match[1].trim() : "#000000");
				}
			}
		}

		function serializeSvg(svgEl) {
			const clone = svgEl.cloneNode(true);
			const interactive = clone.querySelectorAll("[data-interactive]");
			for (const node of Array.prototype.slice.call(interactive)) {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
			const bg = clone.querySelector("[data-bg]");
			if (bg) bg.setAttribute("fill", "#ffffff");
			inlineVariables(clone);
			clone.setAttribute("xmlns", SVG_NS);
			clone.setAttribute("width", String(VB.w));
			clone.setAttribute("height", String(VB.h));
			clone.removeAttribute("class");
			clone.removeAttribute("style");
			return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
		}

		function downloadBlob(blob, fileName) {
			const link = document.createElement("a");
			const url = URL.createObjectURL(blob);
			link.href = url;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			setTimeout(() => URL.revokeObjectURL(url), 2000);
		}

		function exportSvg(svgEl, fileName) {
			const text = serializeSvg(svgEl);
			downloadBlob(new Blob([text], { type: "image/svg+xml;charset=utf-8" }), fileName + ".svg");
		}

		async function exportPng(svgEl, fileName) {
			const text = serializeSvg(svgEl);
			const scale = 3;
			const width = VB.w * scale;
			const height = VB.h * scale;
			const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
			try {
				const image = new Image();
				await new Promise((resolve, reject) => {
					image.onload = () => resolve(null);
					image.onerror = () => reject(new Error("SVG 转图片失败"));
					image.src = url;
				});
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext("2d");
				context.fillStyle = "#ffffff";
				context.fillRect(0, 0, width, height);
				context.drawImage(image, 0, 0, width, height);
				const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
				if (!blob) throw new Error("PNG 编码失败");
				downloadBlob(blob, fileName + ".png");
			} finally {
				URL.revokeObjectURL(url);
			}
		}
		//#endregion
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
			const [cardMode, setCardMode] = react.useState(false);
			const isXrd = frame !== null && frame.id === "xrd";

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
					const result = await readFileEntries(files, cardMode);
					loadInto(state, dispatch, result, cardMode);
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
					const result = await readPathEntries(paths, cardMode);
					loadInto(state, dispatch, result, cardMode);
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
					isXrd
						? h(
								"div",
								{
									className: "sp_modeRow",
									title:
										"当前模式决定拖入 / 粘贴进来的文件按什么解析：" +
										(cardMode
											? "标准卡片（ICDD / PDF 卡片，跳过 (hkl) 等非数字列，画成竖线）"
											: "常规数据（两列 X / Y 数值表）")
								},
								h(
									"div",
									{ className: "sp_modeSeg", role: "group", "aria-label": "导入解析模式" },
									h(
										"button",
										{
											type: "button",
											className: "sp_modeSegBtn" + (cardMode ? "" : " sp_modeSegOn"),
											title: "常规数据：两列（或多列）X / Y 数值表",
											"aria-pressed": !cardMode,
											onClick: () => setCardMode(false)
										},
										"常规数据"
									),
									h(
										"button",
										{
											type: "button",
											className: "sp_modeSegBtn" + (cardMode ? " sp_modeSegOn" : ""),
											title: "标准卡片：ICDD / PDF 卡片文本，按峰位画竖线",
											"aria-pressed": cardMode,
											onClick: () => setCardMode(true)
										},
										"标准卡片"
									)
								)
							)
						: null,
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
		// 持久化的纯逻辑（序列化 / 校验）在 20-store，这里只包 localStorage 读写。
		function safeStorage() {
			try {
				if (typeof window === "undefined" || !window.localStorage) return null;
				return window.localStorage;
			} catch (error) {
				return null; // 隐私模式或被策略禁用
			}
		}

		/** @returns {object|null} 只在首次挂载时同步调用，避免先渲染一帧空白首页。 */
		function loadPersistedState() {
			const store = safeStorage();
			if (store === null) return null;
			try {
				return deserializeState(store.getItem(STORAGE_KEY));
			} catch (error) {
				return null;
			}
		}

		/** @returns {"ok"|"light"|"failed"|"unavailable"} */
		function savePersistedState(state) {
			const store = safeStorage();
			if (store === null) return "unavailable";
			try {
				store.setItem(STORAGE_KEY, serializeState(state));
				return "ok";
			} catch (error) {
				/* QuotaExceededError：转降级写法 */
			}
			try {
				// 只留视图与配色，丢掉 xs / ys —— 总比整个状态丢掉好。
				store.setItem(STORAGE_KEY, serializeState(state, { light: true }));
				return "light";
			} catch (error) {
				return "failed";
			}
		}

		function SciPlotApp() {
			// 惰性初始化：第一帧就是恢复后的状态，不会先闪一下首页。
			const [state, setState] = react.useState(() => {
				const restored = loadPersistedState();
				return restored === null ? initialState : restored;
			});
			const dispatch = react.useCallback((action) => {
				setState((previous) => reducer(previous, action));
			}, []);
			const warned = react.useRef(false);
			react.useEffect(() => {
				if (!state.notice) return undefined;
				const timer = setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), 4600);
				return () => clearTimeout(timer);
			}, [state.notice]);
			// 防抖 400ms：拖拽 / 缩放是每帧 dispatch，不能每帧写存储。
			// 依赖只列需要持久化的字段 —— 提示条的增删不会触发一次写盘。
			react.useEffect(() => {
				const timer = setTimeout(() => {
					const result = savePersistedState(state);
					if (result !== "light" && result !== "failed") return;
					if (warned.current) return;
					warned.current = true;
					dispatch({
						type: "NOTICE",
						tone: "warn",
						text:
							result === "light"
								? "数据太大未能完整保存，只保留了视图与配色；曲线数据下次需要重新导入。"
								: "面板状态未能写入本机存储，关闭后需要重新导入。"
					});
				}, 400);
				return () => clearTimeout(timer);
			}, [state.screen, state.frameId, state.datasets, state.guides, state.view, state.axis, state.tool, state.selected]);
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
