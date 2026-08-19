
export function defaultCanvasMetadata(): CanvasMetadata {
  return { type: "basic", description: "", layers: [{ id: "main", name: "Main layer" }], activeLayerId: "main" };
}

export type CanvasGridStyle = "lines" | "dots" | "none";
export type CanvasTheme = "light" | "dark";
export type CanvasType = "basic" | "flowchart" | "mind-map";
export type CanvasLayer = { id: string; name: string };
export type CanvasMetadata = { type: CanvasType; description: string; layers: CanvasLayer[]; activeLayerId: string };
