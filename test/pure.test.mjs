import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const srcDir = join(root, "src");
const DATA = "D:\\Research\\data";

function collectPure() {
	let out = "";
	const files = readdirSync(srcDir).filter((name) => name.endsWith(".js")).sort();
	for (const file of files) {
		const text = readFileSync(join(srcDir, file), "utf8");
		const pattern = /\/\* @pure-begin \*\/([\s\S]*?)\/\* @pure-end \*\//g;
		let match = pattern.exec(text);
		while (match !== null) {
			out += match[1] + "\n";
			match = pattern.exec(text);
		}
	}
	return out;
}

const exported = [
	"parseTable",
	"decodeBytes",
	"parseFormula",
	"evalNode",
	"niceTicks",
	"formatTick",
	"computeOffsets",
	"differentiate",
	"valueAt",
	"decimate",
	"displayName",
	"liveOffsets",
	"computeAutoView",
	"reducer",
	"initialState",
	"FRAMES"
];

const headText = readFileSync(join(srcDir, "00-head.js"), "utf8");
const paletteMatch = /const PALETTE = (\[[^;]+\]);/.exec(headText);
if (paletteMatch === null) {
	console.error("PALETTE not found in src/00-head.js");
	process.exit(1);
}
const prelude = `const PALETTE = ${paletteMatch[1]};
`;
const pure = prelude + collectPure();
if (pure.trim().length === 0) {
	console.error("no @pure-begin/@pure-end blocks found in src/");
	process.exit(1);
}
const api = new Function(`${pure}\nreturn { ${exported.join(", ")} };`)();

let failures = 0;
function check(name, ok, detail) {
	if (ok) {
		console.log(`  ok    ${name}`);
		return;
	}
	failures += 1;
	console.log(`  FAIL  ${name}${detail === undefined ? "" : ` — ${detail}`}`);
}

function loadSample(relative) {
	const full = join(DATA, relative);
	if (!existsSync(full)) {
		console.log(`  skip  ${relative} (not found)`);
		return null;
	}
	const decoded = api.decodeBytes(new Uint8Array(readFileSync(full)));
	return { decoded, table: api.parseTable(decoded.text) };
}

console.log("pure blocks: " + pure.length + " chars");

console.log("\n# scale and geometry");
{
	const ticks = api.niceTicks(4000, 400, 6);
	check("niceTicks on a reversed range", ticks.lo === 400 && ticks.hi === 4000 && ticks.ticks.length > 0, JSON.stringify(ticks).slice(0, 120));
	check("niceTicks stays inside the range", ticks.ticks.every((value) => value >= 400 - 1e-6 && value <= 4000 + 1e-6));

	const offsets = api.computeOffsets([{ ys: [0, 10] }, { ys: [5, 15] }]);
	check("computeOffsets stack rule", Math.abs(offsets[0]) < 1e-9 && Math.abs(offsets[1] - 5.8) < 1e-9, offsets.join(","));

	const live = api.liveOffsets([
		{ ys: [0, 10], offsetMode: "auto" },
		{ ys: [5, 15], offsetMode: "auto" }
	]);
	check("liveOffsets matches computeOffsets", Math.abs(live[1] - 5.8) < 1e-9, live.join(","));

	const manual = api.liveOffsets([{ ys: [0, 10], offsetMode: "manual", yOffset: 2 }, { ys: [0, 10], offsetMode: "off" }]);
	check("liveOffsets honours manual and off", manual[0] === 2 && manual[1] === 0, manual.join(","));

	const view = api.computeAutoView([{ xs: [1, 2, 3], ys: [0, 1, 0], visible: true }], [0], false);
	check("computeAutoView pads both axes", Math.abs(view.xLo - 0.98) < 1e-9 && Math.abs(view.xHi - 3.02) < 1e-9 && Math.abs(view.yLo + 0.05) < 1e-9 && Math.abs(view.yHi - 1.05) < 1e-9, JSON.stringify(view));

	const reversed = api.computeAutoView([{ xs: [1, 2, 3], ys: [0, 1, 0], visible: true }], [0], true);
	check("computeAutoView flips X when reversed", reversed.xLo > reversed.xHi, JSON.stringify(reversed));

	check("computeAutoView returns null with no data", api.computeAutoView([], [], false) === null);
}

console.log("\n# derivatives and readouts");
{
	const forward = Array.from(api.differentiate([1, 2, 3, 4], [1, 4, 9, 16]));
	check("differentiate central + one-sided ends", Math.abs(forward[0] - 3) < 1e-9 && Math.abs(forward[1] - 4) < 1e-9 && Math.abs(forward[2] - 6) < 1e-9 && Math.abs(forward[3] - 7) < 1e-9, forward.join(","));

	const backward = Array.from(api.differentiate([4, 3, 2, 1], [16, 9, 4, 1]));
	check("differentiate keeps the sign on a descending X", Math.abs(backward[1] - 6) < 1e-9, backward.join(","));

	const read = api.valueAt([1, 2, 3], [10, 20, 30], 2.5);
	check("valueAt interpolates", Math.abs(read.y - 25) < 1e-9 && read.exact === false, JSON.stringify(read));

	const exact = api.valueAt([1, 2, 3], [10, 20, 30], 2);
	check("valueAt finds exact samples", exact.y === 20 && exact.exact === true);

	const points = api.decimate([1, 2, 3, 4], [1, 9, 2, 8], (x, y) => [x, y], 64);
	check("decimate keeps the extremes", points.some((point) => point.py === 9) && points.some((point) => point.py === 2), JSON.stringify(points));
}

console.log("\n# formula engine");
{
	const parsed = api.parseFormula("(2*pi*f*y)^2");
	check("parseFormula accepts the Mott-Schottky form", parsed.ok === true, parsed.ok ? "" : parsed.error);
	if (parsed.ok) {
		const value = api.evalNode(parsed.node, (name) => (name === "f" ? 1000 : name === "y" ? 2 : undefined));
		const expected = Math.pow(2 * Math.PI * 1000 * 2, 2);
		check("evalNode computes 1/C²", Math.abs(value - expected) / expected < 1e-9, `${value} vs ${expected}`);
	}
	check("parseFormula reports unknown names", api.parseFormula("y + zz").ok === false);
	check("parseFormula rejects unbalanced parens", api.parseFormula("(y").ok === false);
	const divide = api.parseFormula("y/x");
	const nan = api.evalNode(divide.node, (name) => (name === "y" ? 1 : 0));
	check("evalNode returns NaN on divide by zero", Number.isNaN(nan), String(nan));
}

console.log("\n# reducer");
{
	const opened = api.reducer(api.initialState, { type: "OPEN_FRAME", frameId: "ftir" });
	check("OPEN_FRAME enters the plot screen", opened.screen === "plot" && opened.frameId === "ftir" && opened.datasets.length === 0);
	check("OPEN_FRAME takes the frame axis defaults", opened.axis.reverseX === true && /cm/.test(opened.axis.xLabel), JSON.stringify(opened.axis));

	const added = api.reducer(opened, {
		type: "ADD_DATASETS",
		list: [{ name: "a", xs: Float64Array.from([1, 2]), ys: Float64Array.from([1, 2]) }]
	});
	check("ADD_DATASETS stacks in the FTIR frame", added.datasets.length === 1 && added.datasets[0].offsetMode === "auto", JSON.stringify(added.datasets[0] && added.datasets[0].offsetMode));

	const xrd = api.reducer(api.reducer(api.initialState, { type: "OPEN_FRAME", frameId: "xrd" }), {
		type: "ADD_DATASETS",
		list: [{ name: "b", xs: Float64Array.from([1, 2]), ys: Float64Array.from([1, 2]) }]
	});
	check("ADD_DATASETS does not stack in the XRD frame", xrd.datasets[0].offsetMode === "off");

	const cleared = api.reducer(added, { type: "CLEAR_ALL" });
	check("CLEAR_ALL empties data and view", cleared.datasets.length === 0 && cleared.view === null && cleared.guides.length === 0);
}

console.log("\n# real samples");
{
	const ftir = loadSample("2024以及以前\\20230328红外\\11.txt");
	if (ftir !== null) {
		check("FTIR parses", ftir.table.ok === true, ftir.table.ok ? "" : ftir.table.reason);
		if (ftir.table.ok) {
			const xs = ftir.table.columns[0];
			check("FTIR row count", ftir.table.rows > 100, String(ftir.table.rows));
			check("FTIR records the JCAMP header", ftir.table.startLine > 0 || ftir.decoded.encoding !== "utf-8", `startLine=${ftir.table.startLine} encoding=${ftir.decoded.encoding}`);
			check("FTIR ascending X", xs[0] < xs[ftir.table.rows - 1], `${xs[0]} → ${xs[ftir.table.rows - 1]}`);
			check("FTIR columns are numeric", xs.every((value) => Number.isFinite(value)));
		}
	}

	const xrd = loadSample("2024以及以前\\20221017XRD\\XRD\\MIL53(Al)_001.txt");
	if (xrd !== null) {
		check("XRD parses", xrd.table.ok === true, xrd.table.ok ? "" : xrd.table.reason);
		if (xrd.table.ok) {
			const xs = xrd.table.columns[0];
			check("XRD row count", xrd.table.rows > 500, String(xrd.table.rows));
			check("XRD ascending 2θ", xs[0] < xs[xrd.table.rows - 1], `${xs[0]} → ${xs[xrd.table.rows - 1]}`);
		}
	}

	const comma = loadSample("2024以及以前\\202205-\\20211204\\6-DPV-50PPM.txt");
	if (comma !== null) {
		check("comma table parses", comma.table.ok === true, comma.table.ok ? "" : comma.table.reason);
		if (comma.table.ok) {
			const xs = comma.table.columns[0];
			check("comma table keeps the descending file order", xs[0] > xs[comma.table.rows - 1], `${xs[0]} → ${xs[comma.table.rows - 1]}`);
		}
	}

	const ms = loadSample("20250321\\补做的MS\\FeMg-5000.txt");
	if (ms !== null) {
		check("Mott-Schottky table parses", ms.table.ok === true, ms.table.ok ? "" : ms.table.reason);
		if (ms.table.ok) {
			check("Mott-Schottky has nine columns", ms.table.columns.length === 9, String(ms.table.columns.length));
			check("Mott-Schottky skips the base64 header line", ms.table.startLine >= 1, String(ms.table.startLine));
			check("Mott-Schottky rows", ms.table.rows > 5, String(ms.table.rows));
		}
	}

	const gbk = loadSample("2024以及以前\\test\\370500-5.txt");
	if (gbk !== null) {
		check("GBK sample decodes without replacement chars", gbk.decoded.encoding === "gbk" || gbk.decoded.text.indexOf("\uFFFD") === -1, gbk.decoded.encoding);
		check("GBK sample parses", gbk.table.ok === true, gbk.table.ok ? "" : gbk.table.reason);
	}

	const rigaku = loadSample("20261015COF-XRD\\COF.txt");
	if (rigaku !== null) {
		check("Rigaku RAS header parses", rigaku.table.ok === true, rigaku.table.ok ? "" : rigaku.table.reason);
		if (rigaku.table.ok) {
			const xs = rigaku.table.columns[0];
			check("Rigaku 2theta starts at 2", Math.abs(xs[0] - 2) < 1e-6, String(xs[0]));
			check("Rigaku 2theta ends at 60", Math.abs(xs[rigaku.table.rows - 1] - 60) < 1e-6, String(xs[rigaku.table.rows - 1]));
			check("Rigaku skips the RAS header", rigaku.table.startLine > 700, String(rigaku.table.startLine));
			check("Rigaku row count", rigaku.table.rows > 5000, String(rigaku.table.rows));
		}
	}
}

console.log("");
if (failures === 0) {
	console.log("all checks passed");
} else {
	console.log(`${failures} check(s) failed`);
	process.exitCode = 1;
}
