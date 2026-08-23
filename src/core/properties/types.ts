import type {
  ArrowHead,
  ArrowRenderMode,
  BaseShapeObjectInit,
  TextFont,
  TextFormat,
  TextWeight,
} from "../model";
import type { CanvasTool } from "../types";

export const CANVAS_MIXED_VALUE = "__canvas_mixed_value__" as const;

export type CanvasMixedValue = typeof CANVAS_MIXED_VALUE;

export interface CanvasPropertyValues {
  opacity: number;
  fill: number;
  stroke: number;
  strokeWidth: number;
  fillStyle: NonNullable<BaseShapeObjectInit["fillStyle"]>;
  cornerRadius: number;
  arcSweep: number;
  waistRatio: number;
  shoulderRatio: number;
  apexRatio: number;
  slantRatio: number;
  backgroundColor: number;
  color: number;
  format: TextFormat;
  fontSize: number;
  fontFamily: TextFont;
  weight: TextWeight;
  italic: boolean;
  underline: boolean;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
  lineHeight: number;
  letterSpacing: number;
  renderMode: ArrowRenderMode;
  startHead: ArrowHead;
  endHead: ArrowHead;
  lockAspectRatio: boolean;
}

export type CanvasPropertyName = keyof CanvasPropertyValues;
export type CanvasPropertyPatch = Partial<CanvasPropertyValues>;
export type CanvasPropertyDefault = Readonly<CanvasPropertyPatch>;
export type CanvasPropertyDefaultsByTool = Partial<Record<CanvasTool, CanvasPropertyDefault>>;

export interface CanvasPropertyOption<T extends string = string> {
  value: T;
  label: string;
}

export type CanvasPropertyControl = "number" | "color" | "select" | "boolean";

export interface CanvasPropertyField<K extends CanvasPropertyName = CanvasPropertyName> {
  name: K;
  label: string;
  control: CanvasPropertyControl;
  value: CanvasPropertyValues[K] | CanvasMixedValue;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly CanvasPropertyOption[];
}

export interface CanvasPropertyContext {
  mode: "none" | "defaults" | "selection";
  tool: CanvasTool;
  selectionCount: number;
  fields: readonly CanvasPropertyField[];
}

export type CanvasPropertiesListener = (context: CanvasPropertyContext) => void;
