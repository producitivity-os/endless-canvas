import type { BoardDrag, CanvasTool, DetailDrag } from ".";
import { CanvasSelectionState, type CanvasAssetAdapter } from "../runtime";
import type { EndlessCanvasState } from "./canvas";

export type EndlessCanvasOptions = {
  initialState?: EndlessCanvasState;
  onChange?: (state: CanvasState) => void;
  assets?: CanvasAssetAdapter;
  onError?: (error: unknown) => void;
};

export class EndlessCanvasRuntimeState {
  viewport = {
    x: 0,
    y: 0,
    scale: 1,
  };

  selection = new CanvasSelectionState();

  tool: CanvasTool = "select";

  // hoveredLinkId = "";
  // hoveredElementId = "";

  // boardDrag: BoardDrag | null = null;
  //
  // detailDrag: DetailDrag | null = null;
}
