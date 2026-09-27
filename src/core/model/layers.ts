import type { EndlessCanvasState } from "../types/canvas.ts";
import type { CanvasLayer } from "./canvas.ts";

export const DEFAULT_CANVAS_LAYER_ID = "main";
export const DEFAULT_UNFOCUSED_LAYER_OPACITY = 0.24;
export const DEFAULT_LAYER_INTERACTION_COLOR = 0x3b82f6;

const clampOpacity = (value: number | undefined, fallback = 1): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value! : fallback));

export const normalizeInteractionColor = (value: number | undefined): number =>
  Number.isInteger(value) && value! >= 0 && value! <= 0xffffff
    ? value!
    : DEFAULT_LAYER_INTERACTION_COLOR;

export function uniqueCanvasLayerId(
  layers: readonly CanvasLayer[],
  preferred = "layer",
): string {
  const base = preferred
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "layer";
  const ids = new Set(layers.map((layer) => layer.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function normalizeCanvasLayers(state: EndlessCanvasState): CanvasLayer[] {
  const source = state.layers?.length
    ? state.layers
    : [{ id: DEFAULT_CANVAS_LAYER_ID, name: "Main layer", zIndex: 0, visible: true, opacity: 1, interactionColor: DEFAULT_LAYER_INTERACTION_COLOR }];
  const ordered = source
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => {
      const aIndex = Number.isFinite(a.layer.zIndex) ? a.layer.zIndex : a.index;
      const bIndex = Number.isFinite(b.layer.zIndex) ? b.layer.zIndex : b.index;
      return aIndex - bIndex || a.index - b.index;
    });
  const layers: CanvasLayer[] = [];
  for (const { layer } of ordered) {
    const preferredId = layer.id?.trim();
    const id = preferredId && !layers.some((candidate) => candidate.id === preferredId)
      ? preferredId
      : uniqueCanvasLayerId(layers, preferredId || layer.name);
    layers.push({
      id,
      name: layer.name?.trim() || `Layer ${layers.length + 1}`,
      zIndex: layers.length,
      visible: layer.visible !== false,
      opacity: clampOpacity(layer.opacity),
      interactionColor: normalizeInteractionColor(layer.interactionColor),
    });
  }

  state.layers = layers;
  const requestedActive = state.activeLayerId;
  state.activeLayerId = requestedActive && layers.some((layer) => layer.id === requestedActive)
    ? requestedActive
    : layers.at(-1)!.id;
  state.focusedLayerId = layers.some((layer) => layer.id === state.focusedLayerId)
    ? state.focusedLayerId
    : null;
  state.unfocusedLayerOpacity = clampOpacity(
    state.unfocusedLayerOpacity,
    DEFAULT_UNFOCUSED_LAYER_OPACITY,
  );

  const validIds = new Set(layers.map((layer) => layer.id));
  for (const object of state.objects) {
    if (!validIds.has(object.layerId)) object.layerId = state.activeLayerId;
  }
  return layers;
}

export function canvasLayerInteractionColor(
  state: EndlessCanvasState,
  layerId: string | undefined = state.activeLayerId,
): number {
  const layer = normalizeCanvasLayers(state).find((candidate) => candidate.id === layerId);
  return normalizeInteractionColor(layer?.interactionColor);
}

export function orderedCanvasLayers(state: EndlessCanvasState): CanvasLayer[] {
  return normalizeCanvasLayers(state).slice().sort((a, b) => a.zIndex - b.zIndex);
}

export function visibleCanvasObjects(state: EndlessCanvasState) {
  const layerOrder = new Map(
    normalizeCanvasLayers(state)
      .filter((layer) => layer.visible)
      .map((layer) => [layer.id, layer.zIndex] as const),
  );
  return state.objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => layerOrder.has(object.layerId))
    .sort((a, b) =>
      layerOrder.get(a.object.layerId)! - layerOrder.get(b.object.layerId)! || a.index - b.index,
    )
    .map(({ object }) => object);
}

export function normalizeLayerOrder(layers: CanvasLayer[]): void {
  layers
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach((layer, index) => { layer.zIndex = index; });
}
