export function defaultCanvasMetadata(): CanvasMetadata {
  return {
    type: "basic",
    description: "",
    layers: [{ id: "main", name: "Main layer", zIndex: 0, visible: true, opacity: 1, interactionColor: 0x3b82f6 }],
    activeLayerId: "main",
  };
}

export type CanvasGridStyle = "lines" | "dots" | "none";
export type CanvasTheme = "light" | "dark";
export type CanvasType = "basic" | "flowchart" | "mind-map";
export type CanvasLayer = {
  id: string;
  name: string;
  /** Larger values render above smaller values. */
  zIndex: number;
  visible: boolean;
  opacity: number;
  /** Color used only for transient hover, selection, and editing chrome. */
  interactionColor?: number;
};
export type CanvasMetadata = {
  type: CanvasType;
  description: string;
  layers: CanvasLayer[];
  activeLayerId: string;
};
