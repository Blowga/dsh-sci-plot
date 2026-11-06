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
