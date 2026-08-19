import type { BaseElement } from "../types/elements";
import { RectangleElement } from "./shapes/rectangle";

export class SelectionFrame extends RectangleElement {
  readonly selectionColor: number;
  readonly handleSize: number;
  constructor(target: BaseElement, selectionColor = 0x4f7fe8, handleSize = 9) {
    super({ ...target, fill: 0xffffff, stroke: selectionColor, fillStyle: "none", strokeWidth: 1.75 });
    this.selectionColor = selectionColor; this.handleSize = handleSize;
  }
}
