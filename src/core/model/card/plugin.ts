import type { CanvasCardObject, PluginCard } from "./card.ts";

export interface CanvasPluginCardRenderContext {
  hovered: boolean;
  hoveredRegionId?: string;
  selected: boolean;
  interactionColor: number;
}

export interface CanvasPluginCardDefinition {
  id: string;
  width: number;
  height: number;
  sizePolicy?: "fixed" | "grow-height";
  materialize(card: PluginCard, context: CanvasPluginCardRenderContext): CanvasCardObject;
  hoverLabel?(card: PluginCard): string | null;
}

export interface CanvasPluginCardProvider {
  get(pluginId: string): CanvasPluginCardDefinition | null;
  subscribe?(listener: () => void): () => void;
}
