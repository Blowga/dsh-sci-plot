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
