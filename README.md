# dsh-sci-plot

Scientific plotting panel for [DeepSeek Harness](https://github.com/deepseek-ai): drop a raw instrument file in, get an interactive SVG plot you can zoom, read, annotate and export. Ships FTIR and XRD as separate entry cards; adding another technique is one object in a list.

中文说明见 [README.zh.md](README.zh.md).

## Install

Harness ≥ `0.2.0-rc.2`. Install it from the plugin manager (Plugin panel → install bundle) with the package name:

```
@blowga/dsh-sci-plot
```

Or from the CLI, for a profile the desktop app does not own:

```bash
dsh plugin --profile <profile> install @blowga/dsh-sci-plot
```

A 「科研绘图」 / "Scientific plots" icon appears in the sidebar. No configuration needed; no network requests, no telemetry.

## Usage

1. Pick a card (FTIR or XRD).
2. Import data — drag files onto the plot area, or paste local paths into the box at the bottom (one per line, or separated by `;`).
3. Left rail: pan / box zoom / reset / add vertical guide / differentiate / export PNG / export SVG / clear.
4. Right panel: series list (select, hide, delete), Y offset mode (auto stack / manual / off), axis titles and direction, explicit range, guide list.

## Interactions

| Action | Effect |
| --- | --- |
| Wheel over the plot area | Zoom both axes around the cursor |
| Wheel over the bottom axis strip | Zoom X only |
| Wheel over the left axis strip | Zoom Y only |
| Drag inside the plot | Pan |
| Double click | Reset to fit |
| Right click | Drop a vertical guide at that x |
| Drag a guide | Move it (state is written on release) |
| Hover | Crosshair plus each series' value at that x |
| Drag with the box tool | Zoom to the rectangle |

## Supported input

Plain text tables only. `.txt .csv .dat .dpt .tsv .asc .xy .prn`, decoded as UTF-8, UTF-16 (BOM) or GBK, single file up to 32 MB.

The parser does not assume a header row. It scans for the longest run of lines that split into the same number of numeric fields under one of tab / comma / semicolon / two-or-more spaces / spaces, and treats everything before that as metadata. That covers JCAMP `##KEY=value` headers, CHI workstation dumps, Rigaku SmartLab `*KEY "value"` RAS exports, and quote-wrapped CSV metadata. `##XUNITS` / `##YUNITS` are mapped to axis titles when present. Row order is preserved — a decreasing x sweep (CV return scan) is plotted in file order, not sorted.

Not supported: Excel workbooks, instrument binaries (`.raw`, `.rasx`, `.jip`, `.opju`), multi-column selection beyond picking a pair in code.

## Reading pasted paths

Dragging a file uses the browser File API and never touches the host. Pasting a path goes through a loopback-only, same-origin-checked read route on the host, open to every mounted drive root by default (the loopback + same-origin fence is what keeps other pages out). Point it at an explicit allow-list with `DSH_SCI_PLOT_ROOTS`, semicolon separated:

```bash
DSH_SCI_PLOT_ROOTS="D:\\data;E:\\measurements"
```

## Adding a technique

Append an entry to `FRAMES` in `src/20-store.js`:

```js
{ id: "xps", title: "XPS", glyph: "xrd",
  xLabel: "Binding Energy (eV)", yLabel: "Intensity (a.u.)",
  reverseX: true, stack: false }
```

`glyph` must exist in the `FrameGlyph` switch in `src/40-ui.js` (`ftir` and `xrd` today).

## Development

```bash
npm run build   # src/*.js → lib/client.js
npm run check   # node --check on both halves
npm test        # pure-function + real-sample regression
```

Edit `src/`, never `lib/client.js` — the build concatenates the `src/` parts in filename order. The two `@pure-begin` / `@pure-end` blocks are extracted verbatim by `test/pure.test.mjs` and executed without a DOM, so parsers and the reducer stay testable.

| Path | Role |
| --- | --- |
| `lib/index.js` | Host half: the read-only path route, loopback and same-origin guards |
| `lib/client.js` | Built bundle: slots, SVG renderer, interactions, UI |
| `src/00-head.js` | Bundle header, constants, all CSS (`sp_` prefix) |
| `src/10-pure.js` | Decoding, delimiter detection, formula parser, ticks, derivative, decimation |
| `src/20-store.js` | Offsets, auto view, reducer, `FRAMES` |
| `src/30-render.js` | SVG drawing |
| `src/31-interact.js` | Wheel / drag / box-select / readout / export |
| `src/40-ui.js` | Import, home cards, tool rail, side panel |
| `src/41-ui-plot.js` | Plot screen and app root |
| `src/90-tail.js` | CSS injection, slot registration, exports |

## Limits

- Data lives in page memory only; a reload clears everything.
- Guides are comparison tools and are stripped from SVG/PNG exports, along with the crosshair and selection box.
- Plot text is Times New Roman throughout, four-sided frame, line width 2, low-saturation five-colour palette — the FTIR house style imported from the author's Origin workflow.

## License

MIT.
