import { arrowBindingResolver } from "../engine/arrows/arrow-binding-resolver.ts";
import type { ArrowObject } from "../model/arrow/arrow.ts";
import type { EndlessCanvasState } from "../types/canvas.ts";
import { CanvasSelectionController } from "./selection.ts";

export class CanvasSelectionMutation {
  private readonly state: EndlessCanvasState;
  private readonly selection: CanvasSelectionController;

  constructor(state: EndlessCanvasState, selection: CanvasSelectionController) {
    this.state = state;
    this.selection = selection;
  }

  deleteSelection(): boolean {
    const selected = this.selection.objects;
    if (selected.size === 0) {
      return false;
    }

    for (const object of this.state.objects) {
      if (object.type !== "arrow" || selected.has(object.id)) {
        continue;
      }
      const arrow = object as ArrowObject;
      for (const endpoint of [arrow.start, arrow.end]) {
        if (endpoint.binding && selected.has(endpoint.binding.objectId)) {
          endpoint.point = arrowBindingResolver.resolve(endpoint, this.state.objects);
          endpoint.binding = undefined;
        }
      }
      arrow.updateBounds();
    }

    const originalCount = this.state.objects.length;
    const retained = this.state.objects.filter((object) => !selected.has(object.id));
    this.state.objects.splice(0, this.state.objects.length, ...retained);
    this.selection.clear();
    return originalCount !== this.state.objects.length;
  }

  selectAll(): void {
    this.selection.clear();
    for (const object of this.state.objects) {
      this.selection.selectObject(object.id, true);
    }
  }
}
