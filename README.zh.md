# dsh-sci-plot · 科研绘图

DeepSeek Harness 的科研绘图面板：把仪器导出的原始数据文件拖进来，得到可缩放、可读点、可加标注、可导出的交互式 SVG 曲线图。目前有红外 FTIR 与 X 射线衍射 XRD 两张入口卡片，加一种表征只需往列表里补一个对象。

## 安装

要求 Harness ≥ `0.2.0-rc.2`。在插件面板里安装 bundle，包名填：

```
@blowga/dsh-sci-plot
```

或者命令行（用于桌面应用不独占的 profile）：

```bash
dsh plugin --profile <profile> install @blowga/dsh-sci-plot
```

侧栏出现「科研绘图」图标即可。不需要任何配置，不联网，不上报。

## 使用

1. 首页点一张卡片进入绘图台。
2. 导入数据：把文件拖进绘图区，或在底部输入框粘本地路径（一行一个，或用 `;` 分隔）。支持 `.txt .csv .dat .dpt .tsv .asc .xy .prn`。
3. 左栏：平移 / 框选放大 / 复位 / 加竖线 / 对选中曲线求导 / 导出 PNG / 导出 SVG / 清空。
4. 右栏：曲线列表（选中、显隐、删除）、Y 偏移模式（自动堆叠 / 手动 / 不偏移）、坐标轴标题与反向、手动填写的显示范围、竖线列表。

## 交互

| 操作 | 效果 |
| --- | --- |
| 绘图区内滚轮 | 双轴缩放，鼠标位置为锚点 |
| 底部轴带滚轮 | 只缩放 X 轴 |
| 左侧轴带滚轮 | 只缩放 Y 轴 |
| 拖动绘图区 | 平移视图 |
| 双击绘图区 | 复位到自动适应 |
| 右键绘图区 | 在该处加一条竖线 |
| 拖动竖线 | 移动；松手才写回状态 |
| 悬停绘图区 | 十字线 + 每条曲线在该 X 处的读数 |
| 框选工具下拖动 | 框选区域放大 |

## 支持的数据

只读纯文本表格，单文件上限 32 MB，编码按 UTF-8 → UTF-16(BOM) → GBK 自动判定。

解析器不假设有表头：它找出「连续多行能被同一种分隔符切成同样多的纯数字字段」的那一段，之前的行一律当元数据。因此 JCAMP 的 `##KEY=value`、CHI 工作站的文本导出、Rigaku SmartLab 的 `*KEY "value"` RAS 导出、带引号的 CSV 元数据都能自动跳过。`##XUNITS` / `##YUNITS` 存在时会映射成轴标题。**行序保持原样**——递减的回扫曲线不会被排序成锯齿。

不支持：Excel 工作簿、仪器二进制（`.raw` / `.rasx` / `.jip` / `.opju`）。

## 路径导入的读取范围

拖拽走浏览器 File API，完全不经过 host。粘贴路径走 host 上一条只读路由：仅限本机回环、校验同源，默认对本机所有已挂载的盘符根开放（拦住其他页面的是回环 + 同源校验）。要收成白名单，用环境变量 `DSH_SCI_PLOT_ROOTS` 指定，分号分隔：

```bash
DSH_SCI_PLOT_ROOTS="D:\\data;E:\\measurements"
```

## 加一种表征

往 `src/20-store.js` 的 `FRAMES` 里追加一项：

```js
{ id: "xps", title: "X 射线光电子能谱 XPS", glyph: "xrd",
  xLabel: "Binding Energy (eV)", yLabel: "Intensity (a.u.)",
  reverseX: true, stack: false }
```

`glyph` 必须是 `src/40-ui.js` 的 `FrameGlyph` 里已有的字形（当前 `ftir`、`xrd`）。

## 开发

```bash
npm run build   # src/*.js → lib/client.js
npm run check   # 两半都过 node --check
npm test        # 纯函数 + 真实样本回归
```

改 `src/`，不要改 `lib/client.js`——构建按文件名顺序拼接。两处 `@pure-begin` / `@pure-end` 之间的代码会被 `test/pure.test.mjs` 原样抽出来在无 DOM 环境里执行，所以解析器和 reducer 一直是可测的。

## 边界

- 数据只活在页面内存里，刷新即清空。
- 竖线是比对工具，导出 SVG / PNG 时会连同十字线、框选一起剥掉。
- 图内文字统一 Times New Roman，四边框，线宽 2，低饱和五色——沿用作者 Origin 工作流里的红外成图样式。

## 许可证

MIT。
