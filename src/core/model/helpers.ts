import type { Container, Graphics } from "pixi.js";
import type { CanvasElement, LinkHead, LinkNode, LinkRouting, Point } from "../types/types";
import type { CanvasCard } from "./card";
import { PathElement } from "./shapes/shape";
import { RectangleElement } from "./shapes/rectangle";
import { EllipseElement } from "./shapes/ellipse";
import { ImageElement } from "./image";
import type { BaseArrow } from "./arrow";

export const cardCenter = (node: LinkNode): Point => ({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
export const cardAnchorPoint = (node: LinkNode, anchor: Point = { x: 0.5, y: 0.5 }): Point => ({ x: node.x + node.width * anchor.x, y: node.y + node.height * anchor.y });
export const normalizedCardAnchor = (node: LinkNode, point: Point): Point => ({ x: Math.max(0, Math.min(1, (point.x - node.x) / Math.max(1, node.width))), y: Math.max(0, Math.min(1, (point.y - node.y) / Math.max(1, node.height))) });
export function cardEdgePoint(node: LinkNode, toward: Point) { const center = cardCenter(node); const dx = toward.x - center.x; const dy = toward.y - center.y; const scale = 1 / Math.max(Math.abs(dx) / Math.max(1, node.width / 2), Math.abs(dy) / Math.max(1, node.height / 2), 1); return { x: center.x + dx * scale, y: center.y + dy * scale }; }
export function bezierPoint(start: Point, c1: Point, c2: Point, end: Point, t: number) { const m = 1 - t; return { x: m ** 3 * start.x + 3 * m ** 2 * t * c1.x + 3 * m * t ** 2 * c2.x + t ** 3 * end.x, y: m ** 3 * start.y + 3 * m ** 2 * t * c1.y + 3 * m * t ** 2 * c2.y + t ** 3 * end.y }; }
const contains = (node: LinkNode, point: Point) => point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;

export function straightLinkGeometry(from: LinkNode, to: LinkNode, fromAnchor: Point, toAnchor: Point, bend: number) {
  const start = cardAnchorPoint(from, fromAnchor); const end = cardAnchorPoint(to, toAnchor); const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }; const length = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)); const control = { x: middle.x - ((end.y - start.y) / length) * bend, y: middle.y + ((end.x - start.x) / length) * bend };
  const full = Array.from({ length: 65 }, (_, step) => { const t = step / 64; const m = 1 - t; return { x: m * m * start.x + 2 * m * t * control.x + t * t * end.x, y: m * m * start.y + 2 * m * t * control.y + t * t * end.y }; });
  let first = full.findIndex((point) => !contains(from, point)); if (first < 0) first = 0; let last = full.length - 1; while (last > 0 && contains(to, full[last])) last -= 1; if (last <= first) last = Math.min(full.length - 1, first + 1);
  return { full, visible: full.slice(first, last + 1), sourceGuide: full.slice(0, first + 1), targetGuide: full.slice(last), anchorStart: start, anchorEnd: end };
}

export function cardLinkPoints(from: LinkNode, to: LinkNode, routing: LinkRouting, fromAnchor: Point = { x: 0.5, y: 0.5 }, toAnchor: Point = { x: 0.5, y: 0.5 }, bend = 0) {
  if (routing === "straight") return straightLinkGeometry(from, to, fromAnchor, toAnchor, bend).visible;
  const fromCenter = cardAnchorPoint(from, fromAnchor); const toCenter = cardAnchorPoint(to, toAnchor); const middle = { x: (fromCenter.x + toCenter.x) / 2, y: (fromCenter.y + toCenter.y) / 2 }; const length = Math.max(1, Math.hypot(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y)); const control = { x: middle.x - ((toCenter.y - fromCenter.y) / length) * bend, y: middle.y + ((toCenter.x - fromCenter.x) / length) * bend }; const start = cardEdgePoint(from, Math.abs(bend) > 0.1 ? control : toCenter); const end = cardEdgePoint(to, Math.abs(bend) > 0.1 ? control : fromCenter);
  if (routing === "orthogonal") { const x = (start.x + end.x) / 2; return [start, { x, y: start.y }, { x, y: end.y }, end]; }
  const geometry = cubicArrowGeometry(start, end, 80, 0.45); return Array.from({ length: 25 }, (_, step) => bezierPoint(start, geometry.control1, geometry.control2, end, step / 24));
}

const distanceToSegment = (point: Point, a: Point, b: Point) => { const dx = b.x - a.x; const dy = b.y - a.y; const squared = dx * dx + dy * dy; if (squared <= 0.0001) return Math.hypot(point.x - a.x, point.y - a.y); const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared)); return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)); };
export function linkBounds(from: LinkNode, to: LinkNode, routing: LinkRouting, fromAnchor?: Point, toAnchor?: Point, bend = 0) { const points = cardLinkPoints(from, to, routing, fromAnchor, toAnchor, bend); const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y); const x = Math.min(...xs); const y = Math.min(...ys); return new Rectangle(x, y, Math.max(1, Math.max(...xs) - x), Math.max(1, Math.max(...ys) - y)); }
export function pointNearLink(point: Point, from: LinkNode, to: LinkNode, routing: LinkRouting, tolerance: number, fromAnchor?: Point, toAnchor?: Point, bend = 0) { const points = cardLinkPoints(from, to, routing, fromAnchor, toAnchor, bend); return points.slice(1).some((next, index) => distanceToSegment(point, points[index], next) <= tolerance); }

function headBase(tip: Point, from: Point, scale: number) { const angle = Math.atan2(tip.y - from.y, tip.x - from.x); return { x: tip.x - Math.cos(angle) * 12 * scale, y: tip.y - Math.sin(angle) * 12 * scale }; }
function drawHead(graphics: Graphics, head: LinkHead, tip: Point, from: Point, color: number, scale: number) { if (head === "none") return; const angle = Math.atan2(tip.y - from.y, tip.x - from.x); const length = 12 * scale; const spread = head === "chicken" ? 9 * scale : 7 * scale; const base = headBase(tip, from, scale); const left = { x: base.x + Math.cos(angle + Math.PI / 2) * spread, y: base.y + Math.sin(angle + Math.PI / 2) * spread }; const right = { x: base.x + Math.cos(angle - Math.PI / 2) * spread, y: base.y + Math.sin(angle - Math.PI / 2) * spread }; graphics.moveTo(tip.x, tip.y).lineTo(left.x, left.y); if (head !== "chicken") graphics.lineTo(right.x, right.y).closePath(); else graphics.moveTo(tip.x, tip.y).lineTo(right.x, right.y); if (head === "triangle") graphics.fill({ color }); else graphics.stroke({ color, width: Math.max(1.5, length / 8) }); }

export function drawCardLink(graphics: Graphics, from: LinkNode, to: LinkNode, routing: LinkRouting, viewportScale: number, selected = false, startHead: LinkHead = "none", endHead: LinkHead = "none", fromAnchor: Point = { x: 0.5, y: 0.5 }, toAnchor: Point = { x: 0.5, y: 0.5 }, bend = 0, strokeWidth = 2.8) {
  const scale = 1 / Math.max(0.001, viewportScale); const color = 0x8b5cf6; const points = cardLinkPoints(from, to, routing, fromAnchor, toAnchor, bend); const start = points[0]; const end = points[points.length - 1]; const startNeighbor = points[1] ?? end; const endNeighbor = points[points.length - 2] ?? start; const lineStart = startHead === "none" ? start : headBase(start, startNeighbor, scale); const lineEnd = endHead === "none" ? end : headBase(end, endNeighbor, scale);
  graphics.setStrokeStyle({ color, width: strokeWidth * scale, cap: "round", join: "round" }).moveTo(lineStart.x, lineStart.y); for (const point of points.slice(1, -1)) graphics.lineTo(point.x, point.y); graphics.lineTo(lineEnd.x, lineEnd.y).stroke(); drawHead(graphics, startHead, start, startNeighbor, color, scale); drawHead(graphics, endHead, end, endNeighbor, color, scale);
  if (selected) for (const point of [cardAnchorPoint(from, fromAnchor), cardAnchorPoint(to, toAnchor)]) graphics.circle(point.x, point.y, 4.5 * scale).fill({ color: 0xffffff }).stroke({ color: 0x3b82f6, width: 1.5 * scale });
}
export function drawCardLinkHover(graphics: Graphics, from: LinkNode, to: LinkNode, link: BaseArrow, viewportScale: number) { const scale = 1 / Math.max(0.001, viewportScale); const points = cardLinkPoints(from, to, link.routing, link.fromAnchor, link.toAnchor, link.bend); graphics.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) graphics.lineTo(point.x, point.y); graphics.stroke({ color: 0x3b82f6, width: 1.4 * scale, cap: "round", join: "round" }); }

export function elementLinkNode(element: CanvasElement): LinkNode { if (element.type === "path") { const xs = element.points.map(({ x }) => x); const ys = element.points.map(({ y }) => y); return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) }; } return { x: element.x, y: element.y, width: element.width, height: element.height }; }
export function renderElementArrows(target: Container, card: CanvasCard, scale = 1, selectedIds?: Set<string>, hoveredId = "") { const graphics = new Graphics(); for (const arrow of card.arrows ?? []) { const from = card.elements.find(({ id }) => id === arrow.fromElementId); const to = card.elements.find(({ id }) => id === arrow.toElementId); if (!from || !to) continue; const fromNode = elementLinkNode(from); const toNode = elementLinkNode(to); drawCardLink(graphics, fromNode, toNode, arrow.routing, scale, selectedIds?.has(arrow.id), arrow.startHead, arrow.endHead, arrow.fromAnchor, arrow.toAnchor, arrow.bend, arrow.strokeWidth); if (hoveredId === arrow.id) drawCardLinkHover(graphics, fromNode, toNode, arrow, scale); } target.addChild(graphics); }
export function renderStaticIllustrationArrows(target: Container, card: CanvasCard) { const graphics = new Graphics(); graphics.eventMode = "none"; for (const arrow of card.arrows ?? []) { const from = card.elements.find(({ id }) => id === arrow.fromElementId); const to = card.elements.find(({ id }) => id === arrow.toElementId); if (from && to) drawCardLink(graphics, elementLinkNode(from), elementLinkNode(to), arrow.routing, 1, false, arrow.startHead, arrow.endHead, arrow.fromAnchor, arrow.toAnchor, arrow.bend, arrow.strokeWidth); } target.addChild(graphics); }

export function hydrateElement(element: CanvasElement): CanvasElement {
  if (element instanceof Element || element instanceof PathElement) return element;
  if (element.type === "rect") return new RectangleElement(element);
  if (element.type === "ellipse") return new EllipseElement(element);
  if (element.type === "image") return new ImageElement(element);
  if (element.type === "path") return new PathElement(element) as CanvasElement;
  return element;
}
