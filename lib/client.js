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
 * React 树里；刷新即清空是刻意取舍（用户未选持久化）。
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
			".sp_swatch{width:13px;height:13px;flex:0 0 13px;border-radius:3px;border:1px solid #00000033;cursor:pointer}",
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

		function bindStageEvents(svg, svgRef, stateRef, offsetsRef, viewRef, dispatch) {
			let mode = null;
			let guideId = null;
			let startPx = 0;
			let startPy = 0;
			let startView = null;

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

				updateCross(svg, state, view, offsetsRef.current, local, box);
			};

			const onUp = (event) => {
				const state = stateRef.current;
				const view = viewRef.current;
				const box = plotBox();
				const local = toLocal(svg, event);

				if (mode === "guide" && guideId !== null) {
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

		async function readFileEntries(files) {
			const ok = [];
			const bad = [];
			for (const file of files) {
				try {
					const bytes = new Uint8Array(await file.arrayBuffer());
					const decoded = decodeBytes(bytes);
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

		async function readPathEntry(path) {
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
			const table = parseTable(decoded.text);
			if (!table.ok) throw new Error(table.reason);
			const entry = tableToDataset(data.name || path, table);
			if (entry === null) throw new Error("没有可用的数值列");
			entry.source = "path";
			entry.hasHeader = table.columnNames.some((cell) => cell !== null);
			return entry;
		}

		async function readPathEntries(paths) {
			const ok = [];
			const bad = [];
			for (const path of paths) {
				try {
					ok.push(await readPathEntry(path));
				} catch (error) {
					bad.push(`${path}：${error && error.message ? error.message : "读取失败"}`);
				}
			}
			return { ok, bad };
		}

		function loadInto(state, dispatch, result) {
			if (result.ok.length > 0) {
				dispatch({ type: "ADD_DATASETS", list: result.ok });
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

			const datasetRows = state.datasets.map((item, index) =>
				h(
					"div",
					{ key: item.id, className: "sp_row" + (state.selected === item.id ? " sp_rowOn" : "") },
					h("span", {
						className: "sp_swatch",
						style: { background: item.color },
						onClick: () => dispatch({ type: "SELECT", id: item.id }),
						title: "选中这条曲线"
					}),
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
								h("span", { className: "sp_swatch", style: { background: guide.color } }),
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
