import type { BaseTextElement } from "../model/text";
import type { Point } from "./geometry";

export type BaseElement = { id: string; x: number; y: number; width: number; height: number; rotation?: number };
export type CanvasElement =
  | BaseTextElement
  | (BaseElement & { type: "rect"; fill: number; stroke: number; strokeWidth?: number; opacity?: number; fillStyle?: "solid" | "hachure" | "cross-hatch" | "none"; cornerRadius?: number })
  | (BaseElement & { type: "ellipse"; fill: number; stroke: number; strokeWidth?: number; opacity?: number; fillStyle?: "solid" | "hachure" | "cross-hatch" | "none" })
  | (BaseElement & { type: "image"; src: string; name?: string; crop?: { x: number; y: number; width: number; height: number }; previewSrc?: string; uploadStatus?: "uploading" | "ready" | "failed"; lockAspectRatio?: boolean; opacity?: number; cornerRadius?: number })
  | { id: string; type: "path"; points: Point[]; color: number; width: number; rotation?: number };
