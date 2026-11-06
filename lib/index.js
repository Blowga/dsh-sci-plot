/**
 * dsh-sci-plot — host half.
 *
 * 唯一职责：给「粘贴路径导入」提供一条只读路由。浏览器（渲染进程）拿不到
 * 任意磁盘路径，只有 host 能读；界面侧的文件对话框与拖拽走浏览器 File API，
 * 不经过这里。
 *
 *   GET  /dsh-sci-plot/ping        → 自检
 *   POST /dsh-sci-plot/read-file   → { path } → { ok, name, size, base64 }
 *
 * 返回 base64 字节而不是解码后的文本：UTF-8 / GBK 的判定交给浏览器
 * （TextDecoder 支持 gbk），host 不做编码猜测。
 *
 * 安全边界（三条缺一不可）：
 *   1. 同源 + 回环栅栏（照抄 dsh-lab-planner 的实证写法）；
 *   2. 路径必须落在允许根内（默认 D:\Research，环境变量可覆盖），
 *      realpath 之后再比，防软链接穿越；
 *   3. 扩展名白名单 + 单文件大小上限。
 */
import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export const PLUGIN_NAME = "dsh-sci-plot";
export const PLUGIN_VERSION = "0.1.0";

export const PING_PATH = "/dsh-sci-plot/ping";
export const READ_PATH = "/dsh-sci-plot/read-file";

/** 允许导入的扩展名（第一版只认纯文本表格）。 */
export const ALLOWED_EXTENSIONS = [".txt", ".csv", ".dat", ".dpt", ".tsv", ".asc", ".xy", ".prn"];

/** 单文件上限；一个 0.002° 步长的 XRD 扫描远小于此。 */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

/** 请求体上限：只有一个路径字符串。 */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * 默认允许根：本机所有存在的盘符根（Windows）或 `/`（其它平台）。
 *
 * 不能写死任何人的绝对路径 —— 换个用户就是 403 outside-root；同时也不能只
 * 给主目录 —— 科研数据几乎总在别的盘（D:\data、E:\实验）。真正挡住外部
 * 调用的是 loopback + 同源栅栏，根目录只负责拦住「本机页面把插件当任意
 * 文件读取器」这一层误用。
 *
 * 环境变量 `DSH_SCI_PLOT_ROOTS`（分号分隔）可覆盖成明确的白名单。
 */
function defaultRoots() {
	if (process.platform !== "win32") return [path.sep];
	const out = [];
	for (let code = 65; code <= 90; code += 1) {
		const drive = `${String.fromCharCode(code)}:\\`;
		if (existsSync(drive)) out.push(drive);
	}
	return out.length > 0 ? out : [homedir()];
}

const message = (error) => (error instanceof Error ? error.message : String(error));

class RequestError extends Error {
	constructor(statusCode, code, text) {
		super(text);
		this.statusCode = statusCode;
		this.code = code;
	}
}

//#region loopback fence
/**
 * @param {unknown} address - `req.socket.remoteAddress` or a parsed host.
 * @returns {boolean} whether the address is a loopback literal.
 */
function isLoopbackAddress(address) {
	if (typeof address !== "string" || address.length === 0) return false;
	let value = address;
	// IPv4-mapped IPv6 (`::ffff:127.0.0.1`) must be judged as IPv4.
	if (value.startsWith("::ffff:")) value = value.slice(7);
	if (value === "::1") return true;
	const parts = value.split(".");
	if (parts.length !== 4) return false;
	if (parts[0] !== "127") return false;
	return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/**
 * @param {unknown} value - a raw `Host` header value.
 * @returns {string | undefined} the host without port, brackets, or trailing dot.
 */
function hostNameOf(value) {
	if (typeof value !== "string" || value.length === 0) return undefined;
	let host = value;
	if (host.startsWith("[")) {
		const end = host.indexOf("]");
		if (end !== -1) host = host.slice(1, end);
	} else {
		const colon = host.indexOf(":");
		if (colon !== -1) host = host.slice(0, colon);
	}
	while (host.endsWith(".")) host = host.slice(0, -1);
	return host.length > 0 ? host.toLowerCase() : undefined;
}

/**
 * Reject cross-origin browser callers. A request without `Origin` is not a
 * browser (or is same-origin navigation) and passes.
 *
 * @returns {boolean} true when the response was already written.
 */
function rejectForeignOrigin(req, res) {
	const origin = req.headers?.origin;
	if (origin === undefined || origin === "") return false;
	const host = req.headers?.host;
	if (typeof host === "string" && origin === `http://${host}`) return false;
	json(res, 403, { ok: false, error: "forbidden-origin" });
	return true;
}

/**
 * @param {string[]} [methods] - allowed methods; defaults to the read set.
 * @returns {boolean} true when the request was rejected and answered.
 */
export function rejectForeignCaller(req, res, methods = ["GET", "HEAD"]) {
	if (!methods.includes(req.method ?? "")) {
		json(res, 405, { ok: false, error: "method-not-allowed" });
		return true;
	}
	if (rejectForeignOrigin(req, res)) return true;
	const peer = req.socket?.remoteAddress;
	const host = hostNameOf(req.headers?.host);
	if (isLoopbackAddress(peer) && isLoopbackAddress(host)) return false;
	json(res, 403, { ok: false, error: "forbidden" });
	return true;
}
//#endregion

//#region http helpers
function json(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(body),
		"cache-control": "no-cache"
	});
	res.end(body);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > MAX_BODY_BYTES) throw new RequestError(413, "body-too-large", `请求体超过 ${MAX_BODY_BYTES} 字节`);
		chunks.push(chunk);
	}
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text.length === 0) return {};
	try {
		const parsed = JSON.parse(text);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new RequestError(400, "bad-body", "请求体必须是 JSON 对象");
		}
		return parsed;
	} catch (error) {
		if (error instanceof RequestError) throw error;
		throw new RequestError(400, "bad-body", `请求体不是合法 JSON：${message(error)}`);
	}
}
//#endregion

//#region path policy
/** @returns {string[]} absolute allow-roots, de-duplicated and lower-cased for comparison. */
export function resolveRoots(env = process.env) {
	const raw = typeof env.DSH_SCI_PLOT_ROOTS === "string" ? env.DSH_SCI_PLOT_ROOTS : "";
	const list = raw
		.split(";")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	const roots = list.length > 0 ? list : defaultRoots();
	const out = [];
	for (const entry of roots) {
		const absolute = path.resolve(entry);
		if (!out.some((known) => known.toLowerCase() === absolute.toLowerCase())) out.push(absolute);
	}
	return out;
}

/** Case-insensitive containment on Windows-style paths. */
function isInside(candidate, root) {
	const a = candidate.toLowerCase();
	const b = root.toLowerCase();
	if (a === b) return true;
	const withSep = b.endsWith(path.sep) ? b : b + path.sep;
	return a.startsWith(withSep);
}

/**
 * Resolve a user-supplied path, following symlinks, and prove it is inside one
 * of the allowed roots. Returns the canonical absolute path.
 *
 * @throws {RequestError} when the path escapes every root.
 */
export async function resolveReadablePath(userPath, roots) {
	if (typeof userPath !== "string" || userPath.trim().length === 0) {
		throw new RequestError(400, "empty-path", "路径为空");
	}
	const trimmed = userPath.trim().replace(/^"(.*)"$/, "$1");
	if (trimmed.includes("\0")) throw new RequestError(400, "bad-path", "路径含非法字符");
	const resolved = path.resolve(trimmed);

	let canonical = resolved;
	try {
		canonical = await realpath(resolved);
	} catch {
		// Missing file: keep the resolved path so the caller gets a clear 404.
	}

	const canonicalRoots = [];
	for (const root of roots) {
		try {
			canonicalRoots.push(await realpath(root));
		} catch {
			canonicalRoots.push(root);
		}
	}

	if (!canonicalRoots.some((root) => isInside(canonical, root))) {
		throw new RequestError(
			403,
			"outside-root",
			`路径不在允许范围内。允许的根目录：${canonicalRoots.join("  |  ")}`
		);
	}
	return canonical;
}
//#endregion

//#region route
/**
 * Read one text-table file and return its bytes as base64.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function handleReadFile(req, res, roots) {
	const body = await readJsonBody(req);
	const canonical = await resolveReadablePath(body.path, roots);

	const ext = path.extname(canonical).toLowerCase();
	if (!ALLOWED_EXTENSIONS.includes(ext)) {
		throw new RequestError(
			415,
			"unsupported-extension",
			`不支持的扩展名 ${ext || "（无）"}，只接受 ${ALLOWED_EXTENSIONS.join(" ")}`
		);
	}

	const info = await stat(canonical).catch(() => null);
	if (info === null || !info.isFile()) throw new RequestError(404, "not-a-file", `文件不存在：${canonical}`);
	if (info.size > MAX_FILE_BYTES) {
		throw new RequestError(413, "file-too-large", `文件 ${(info.size / 1048576).toFixed(1)} MB 超过上限 32 MB`);
	}
	if (info.size === 0) throw new RequestError(422, "empty-file", "文件是空的");

	const bytes = await readFile(canonical);
	json(res, 200, {
		ok: true,
		path: canonical,
		name: path.basename(canonical),
		size: bytes.length,
		base64: bytes.toString("base64")
	});
}
//#endregion

/**
 * @param {import('cordis').Context} ctx
 */
export function apply(ctx) {
	const roots = resolveRoots();

	const registerRoute = (route, label) => {
		ctx.effect(() => {
			try {
				return ctx.webServer.register(route);
			} catch (error) {
				// A failed registration must not take the whole web shell down.
				console.warn(`${PLUGIN_NAME}: ${label} skipped — ${message(error)}`);
				return () => {};
			}
		}, `${PLUGIN_NAME}: ${label}`);
	};

	registerRoute(
		{
			kind: "exact",
			path: PING_PATH,
			handler: (req, res) => {
				if (rejectForeignCaller(req, res)) return;
				json(res, 200, {
					ok: true,
					plugin: PLUGIN_NAME,
					version: PLUGIN_VERSION,
					roots,
					maxFileBytes: MAX_FILE_BYTES,
					extensions: ALLOWED_EXTENSIONS
				});
			}
		},
		"ping"
	);

	registerRoute(
		{
			kind: "exact",
			path: READ_PATH,
			handler: async (req, res) => {
				if (rejectForeignCaller(req, res, ["POST"])) return;
				try {
					await handleReadFile(req, res, roots);
				} catch (error) {
					if (error instanceof RequestError) {
						json(res, error.statusCode, { ok: false, error: error.code, message: error.message });
						return;
					}
					console.error(`${PLUGIN_NAME}: read-file failed — ${message(error)}`);
					json(res, 500, { ok: false, error: "internal", message: message(error) });
				}
			}
		},
		"read-file"
	);
}

export const inject = ["webServer"];
