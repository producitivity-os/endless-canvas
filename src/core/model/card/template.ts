import type { CanvasObject } from "../object.ts";
import { canvasObjectFactory } from "../object-factory.ts";
import { IllustrationCard, type CanvasCardObject, type TemplateCard } from "./card.ts";
import type { ImageObject } from "../image/image.ts";
import type { TextObject } from "../text/text.ts";

export type CardTemplateFieldType = "text" | "description" | "image";

export interface CardTemplateImageValue {
  src: string;
  name?: string;
  mediaId?: string;
}

export type CardTemplateValue = string | CardTemplateImageValue;

export interface CardTemplateField {
  id: string;
  label: string;
  type: CardTemplateFieldType;
  required: boolean;
  defaultValue?: CardTemplateValue;
}

export interface CardTemplateBinding {
  elementId: string;
  fieldId: string;
  property: "text" | "image";
}

export interface CardTemplateDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  fields: CardTemplateField[];
  elements: CanvasObject[];
  bindings: CardTemplateBinding[];
  builtIn: boolean;
  revision: number;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface CardTemplateProvider {
  get(templateId: string): CardTemplateDefinition | null;
  list(): readonly CardTemplateDefinition[];
  subscribe?(listener: () => void): () => void;
}

export function templateValue(
  definition: CardTemplateDefinition,
  values: Readonly<Record<string, CardTemplateValue>>,
  fieldId: string,
): CardTemplateValue | undefined {
  if (Object.prototype.hasOwnProperty.call(values, fieldId)) return values[fieldId];
  return definition.fields.find((field) => field.id === fieldId)?.defaultValue;
}

export function materializeTemplateCard(
  card: TemplateCard,
  definition: CardTemplateDefinition,
): CanvasCardObject {
  const bindings = new Map(definition.bindings.map((binding) => [binding.elementId, binding]));
  const elements = structuredClone(definition.elements).map((raw) => {
    const originalId = raw.id;
    const element = canvasObjectFactory.hydrate(raw);
    const binding = bindings.get(originalId);
    if (binding) applyBinding(element, binding, templateValue(definition, card.templateValues, binding.fieldId));
    element.id = `${card.id}::${originalId}`;
    return element;
  });
  return new IllustrationCard({
    id: card.id,
    type: "card",
    layerId: card.layerId,
    x: card.x,
    y: card.y,
    width: definition.width,
    height: definition.height,
    rotation: card.rotation,
    opacity: card.opacity,
    elements,
    backgroundColor: card.backgroundColor,
    locked: card.locked,
    capabilities: card.capabilities,
  });
}

function applyBinding(
  element: CanvasObject,
  binding: CardTemplateBinding,
  value: CardTemplateValue | undefined,
): void {
  if (binding.property === "text" && element.type === "text") {
    (element as TextObject).text = typeof value === "string" ? value : "";
    return;
  }
  if (binding.property === "image" && element.type === "image") {
    const image = element as ImageObject;
    const resolved = typeof value === "object" && value ? value : { src: "" };
    image.src = resolved.src;
    image.name = resolved.name;
    image.uploadStatus = "ready";
  }
}
