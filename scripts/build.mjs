import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const srcDir = join(root, "src");

const order = [
	"00-head.js",
	"10-pure.js",
	"20-store.js",
	"30-render.js",
	"31-interact.js",
	"40-ui.js",
	"41-ui-plot.js",
	"90-tail.js"
];

const chunks = [];
for (const name of order) {
	const text = readFileSync(join(srcDir, name), "utf8");
	if (text.trim().length === 0) throw new Error(`src/${name} is empty`);
	chunks.push(text.replace(/[ \t]+$/gm, "").replace(/\s+$/, "") + "\n");
}

const output = chunks.join("");
mkdirSync(join(root, "lib"), { recursive: true });
writeFileSync(join(root, "lib", "client.js"), output, "utf8");

const lines = output.split("\n").length;
console.log(`lib/client.js  ${order.length} parts, ${output.length} bytes, ${lines} lines`);
