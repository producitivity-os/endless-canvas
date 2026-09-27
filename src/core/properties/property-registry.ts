import type { CanvasObject, CanvasObjectType } from "../model";
import type { CanvasTool } from "../types";
import type {
  CanvasPropertyControl,
  CanvasPropertyName,
  CanvasPropertyOption,
  CanvasPropertyValues,
} from "./types.ts";

type CanvasPropertyValidator<K extends CanvasPropertyName> = (
  value: unknown,
) => CanvasPropertyValues[K] | undefined;

export interface CanvasPropertyDefinition<K extends CanvasPropertyName = CanvasPropertyName> {
  name: K;
  label: string;
  control: CanvasPropertyControl;
  objectTypes: readonly CanvasObjectType[];
  tools: readonly CanvasTool[];
  validate: CanvasPropertyValidator<K>;
  defaultValue?: CanvasPropertyValues[K];
  min?: number;
  max?: number;
  step?: number;
  options?: readonly CanvasPropertyOption[];
}

const allObjectTypes: readonly CanvasObjectType[] = [
  "rect",
  "card",
  "ellipse",
  "diamond",
  "pentagon",
  "parallelogram",
  "image",
  "path",
  "arrow",
  "text",
  "video",
];

const shapeTypes: readonly CanvasObjectType[] = [
  "rect",
  "ellipse",
  "diamond",
  "pentagon",
  "parallelogram",
];

const shapeTools: readonly CanvasTool[] = [
  "rect",
  "ellipse",
  "diamond",
  "pentagon",
  "parallelogram",
];

const creationTools: readonly CanvasTool[] = [
  "text",
  "markdown",
  "card",
  "markdown-card",
  "image",
  "video",
  "arrow",
  "line",
  "pencil",
  ...shapeTools,
];

const numberValidator = (minimum: number, maximum: number) => (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : undefined;
};

const colorValidator = (value: unknown): number | undefined => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 0xffffff ? number : undefined;
};

const booleanValidator = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const enumValidator =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): T | undefined =>
    typeof value === "string" && values.includes(value as T) ? (value as T) : undefined;

const options = <T extends string>(values: readonly T[]): CanvasPropertyOption<T>[] =>
  values.map((value) => ({
    value,
    label: value
      .split("-")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" "),
  }));

const definition = <K extends CanvasPropertyName>(
  value: CanvasPropertyDefinition<K>,
): CanvasPropertyDefinition<K> => value;

const definitions = [
  definition({
    name: "opacity",
    label: "Opacity",
    control: "number",
    objectTypes: allObjectTypes,
    tools: creationTools,
    validate: numberValidator(0, 1),
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.05,
  }),
  definition({
    name: "fill",
    label: "Fill",
    control: "color",
    objectTypes: shapeTypes,
    tools: shapeTools,
    validate: colorValidator,
    defaultValue: 0xffffff,
  }),
  definition({
    name: "stroke",
    label: "Stroke",
    control: "color",
    objectTypes: [...shapeTypes, "arrow"],
    tools: [...shapeTools, "arrow", "line"],
    validate: colorValidator,
    defaultValue: 0x334155,
  }),
  definition({
    name: "strokeWidth",
    label: "Stroke width",
    control: "number",
    objectTypes: [...shapeTypes, "arrow", "path"],
    tools: [...shapeTools, "arrow", "line", "pencil"],
    validate: numberValidator(0.25, 32),
    defaultValue: 2,
    min: 0.25,
    max: 32,
    step: 0.25,
  }),
  definition({
    name: "fillStyle",
    label: "Fill style",
    control: "select",
    objectTypes: shapeTypes,
    tools: shapeTools,
    validate: enumValidator(["solid", "hachure", "cross-hatch", "none"] as const),
    defaultValue: "solid",
    options: options(["solid", "hachure", "cross-hatch", "none"] as const),
  }),
  definition({
    name: "cornerRadius",
    label: "Corner radius",
    control: "number",
    objectTypes: ["rect", "image"],
    tools: ["rect", "image"],
    validate: numberValidator(0, 1000),
    defaultValue: 8,
    min: 0,
    max: 1000,
    step: 1,
  }),
  definition({
    name: "arcSweep",
    label: "Arc sweep",
    control: "number",
    objectTypes: ["ellipse"],
    tools: ["ellipse"],
    validate: numberValidator(0.01, 1),
    defaultValue: 1,
    min: 0.01,
    max: 1,
    step: 0.01,
  }),
  definition({
    name: "waistRatio",
    label: "Waist",
    control: "number",
    objectTypes: ["diamond"],
    tools: ["diamond"],
    validate: numberValidator(0.15, 0.85),
    defaultValue: 0.5,
    min: 0.15,
    max: 0.85,
    step: 0.01,
  }),
  definition({
    name: "shoulderRatio",
    label: "Shoulder",
    control: "number",
    objectTypes: ["pentagon"],
    tools: ["pentagon"],
    validate: numberValidator(0.18, 0.68),
    defaultValue: 0.38,
    min: 0.18,
    max: 0.68,
    step: 0.01,
  }),
  definition({
    name: "apexRatio",
    label: "Apex",
    control: "number",
    objectTypes: ["pentagon"],
    tools: ["pentagon"],
    validate: numberValidator(0.2, 0.8),
    defaultValue: 0.5,
    min: 0.2,
    max: 0.8,
    step: 0.01,
  }),
  definition({
    name: "slantRatio",
    label: "Slant",
    control: "number",
    objectTypes: ["parallelogram"],
    tools: ["parallelogram"],
    validate: numberValidator(0, 0.45),
    defaultValue: 0.2,
    min: 0,
    max: 0.45,
    step: 0.01,
  }),
  definition({
    name: "backgroundColor",
    label: "Background",
    control: "color",
    objectTypes: ["card"],
    tools: ["card", "markdown-card"],
    validate: colorValidator,
    defaultValue: 0xffffff,
  }),
  definition({
    name: "color",
    label: "Color",
    control: "color",
    objectTypes: ["text", "path"],
    tools: ["text", "markdown", "pencil"],
    validate: colorValidator,
    defaultValue: 0x1f2530,
  }),
  definition({
    name: "format",
    label: "Format",
    control: "select",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: enumValidator(["plain", "markdown"] as const),
    defaultValue: "plain",
    options: options(["plain", "markdown"] as const),
  }),
  definition({
    name: "fontSize",
    label: "Font size",
    control: "number",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: numberValidator(6, 240),
    defaultValue: 18,
    min: 6,
    max: 240,
    step: 1,
  }),
  definition({
    name: "fontFamily",
    label: "Font",
    control: "select",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: enumValidator(["inter", "serif", "mono", "rounded"] as const),
    defaultValue: "inter",
    options: options(["inter", "serif", "mono", "rounded"] as const),
  }),
  definition({
    name: "weight",
    label: "Weight",
    control: "select",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: enumValidator(["regular", "bold", "extrabold"] as const),
    defaultValue: "regular",
    options: options(["regular", "bold", "extrabold"] as const),
  }),
  definition({
    name: "italic",
    label: "Italic",
    control: "boolean",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: booleanValidator,
    defaultValue: false,
  }),
  definition({
    name: "underline",
    label: "Underline",
    control: "boolean",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: booleanValidator,
    defaultValue: false,
  }),
  definition({
    name: "textAlign",
    label: "Alignment",
    control: "select",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: enumValidator(["left", "center", "right"] as const),
    defaultValue: "left",
    options: options(["left", "center", "right"] as const),
  }),
  definition({
    name: "verticalAlign",
    label: "Vertical align",
    control: "select",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: enumValidator(["top", "center", "bottom"] as const),
    defaultValue: "top",
    options: options(["top", "center", "bottom"] as const),
  }),
  definition({
    name: "lineHeight",
    label: "Line height",
    control: "number",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: numberValidator(6, 360),
    defaultValue: 24,
    min: 6,
    max: 360,
    step: 1,
  }),
  definition({
    name: "letterSpacing",
    label: "Letter spacing",
    control: "number",
    objectTypes: ["text"],
    tools: ["text", "markdown"],
    validate: numberValidator(-20, 100),
    defaultValue: 0,
    min: -20,
    max: 100,
    step: 0.25,
  }),
  definition({
    name: "renderMode",
    label: "Layer",
    control: "select",
    objectTypes: ["arrow"],
    tools: ["arrow", "line"],
    validate: enumValidator(["between", "over", "under"] as const),
    defaultValue: "between",
    options: options(["between", "over", "under"] as const),
  }),
  definition({
    name: "startHead",
    label: "Start head",
    control: "select",
    objectTypes: ["arrow"],
    tools: ["arrow", "line"],
    validate: enumValidator(["none", "triangle", "triangle-outline", "chicken"] as const),
    defaultValue: "none",
    options: options(["none", "triangle", "triangle-outline", "chicken"] as const),
  }),
  definition({
    name: "endHead",
    label: "End head",
    control: "select",
    objectTypes: ["arrow"],
    tools: ["arrow", "line"],
    validate: enumValidator(["none", "triangle", "triangle-outline", "chicken"] as const),
    defaultValue: "triangle",
    options: options(["none", "triangle", "triangle-outline", "chicken"] as const),
  }),
  definition({
    name: "lockAspectRatio",
    label: "Lock aspect ratio",
    control: "boolean",
    objectTypes: ["image"],
    tools: ["image"],
    validate: booleanValidator,
    defaultValue: true,
  }),
] as const;

export class CanvasPropertyRegistry {
  private readonly definitionsByName = new Map<CanvasPropertyName, CanvasPropertyDefinition>(
    definitions.map((item) => [item.name, item as CanvasPropertyDefinition]),
  );

  all(): readonly CanvasPropertyDefinition[] {
    return definitions;
  }

  definition<K extends CanvasPropertyName>(name: K): CanvasPropertyDefinition<K> | undefined {
    return this.definitionsByName.get(name) as CanvasPropertyDefinition<K> | undefined;
  }

  supportsObject(name: CanvasPropertyName, object: CanvasObject): boolean {
    return this.definitionsByName.get(name)?.objectTypes.includes(object.type) ?? false;
  }

  supportsTool(name: CanvasPropertyName, tool: CanvasTool): boolean {
    return this.definitionsByName.get(name)?.tools.includes(tool) ?? false;
  }

  validate<K extends CanvasPropertyName>(
    name: K,
    value: unknown,
  ): CanvasPropertyValues[K] | undefined {
    return this.definition(name)?.validate(value);
  }

  value<K extends CanvasPropertyName>(
    object: CanvasObject,
    name: K,
  ): CanvasPropertyValues[K] | undefined {
    if (!this.supportsObject(name, object)) return undefined;
    const value = (object as unknown as Partial<CanvasPropertyValues>)[name];
    return value === undefined ? this.definition(name)?.defaultValue : value;
  }
}

export const canvasPropertyRegistry = new CanvasPropertyRegistry();
