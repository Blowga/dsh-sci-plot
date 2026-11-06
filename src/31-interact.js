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
