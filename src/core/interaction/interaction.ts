import type { CanvasController } from "../runtime";
import type { CanvasPoint } from "../types";
import { KeyboardShortcutMapper } from "./keyboard-shortcut-mapper";
import { isCanvasUiTarget } from "./canvas-ui-target.ts";

interface SafariGestureEvent extends Event {
  scale: number;
  rotation: number;

  clientX: number;
  clientY: number;
}
export interface CanvasInteractionControllerOptions {
  el: HTMLDivElement;
  controller: CanvasController;
  shortcutMapper?: KeyboardShortcutMapper;
}
export class CanvasInteractionController {
  private readonly options: CanvasInteractionControllerOptions;
  private readonly shortcutMapper: KeyboardShortcutMapper;
  private gestureStartScale = 1;

  constructor(options: CanvasInteractionControllerOptions) {
    this.options = options;
    this.shortcutMapper = options.shortcutMapper ?? new KeyboardShortcutMapper();
  }

  attach(): void {
    const canvas = this.options.el;

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("dblclick", this.onDoubleClick);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("wheel", this.onWheel, {
      passive: false,
    });
    canvas.addEventListener("gesturestart", this.onGestureStart as EventListener, {
      passive: false,
    });
    canvas.addEventListener("gesturechange", this.onGestureChange as EventListener, {
      passive: false,
    });
    canvas.addEventListener("gestureend", this.onGestureEnd as EventListener, {
      passive: false,
    });
  }

  detach(): void {
    const canvas = this.options.el;

    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("dblclick", this.onDoubleClick);
    canvas.removeEventListener("keydown", this.onKeyDown);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("gesturestart", this.onGestureStart as EventListener);
    canvas.removeEventListener("gesturechange", this.onGestureChange as EventListener);
    canvas.removeEventListener("gestureend", this.onGestureEnd as EventListener);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    this.options.controller.focus();
    this.options.el.setPointerCapture?.(event.pointerId);
    this.options.controller.pointerDown(this.screenPoint(event), event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    this.options.controller.pointerMove(this.screenPoint(event), event);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    this.options.controller.pointerUp(this.screenPoint(event), event);
    if (this.options.el.hasPointerCapture?.(event.pointerId)) {
      this.options.el.releasePointerCapture(event.pointerId);
    }
  };

  private onPointerLeave = (): void => {
    this.options.controller.pointerLeave();
  };

  private onDoubleClick = (event: MouseEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    event.preventDefault();
    this.options.controller.doubleClick(this.screenPoint(event));
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const action = this.shortcutMapper.actionFor(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    this.options.controller.executeShortcut(action);
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const point = this.screenPoint(event);

    // Trackpad pinch zoom.
    if (event.ctrlKey) {
      this.options.controller.zoomAt(point, event.deltaY);

      return;
    }

    // Two-finger trackpad pan.
    this.options.controller.panBy(-event.deltaX, -event.deltaY);
  };

  private screenPoint(event: MouseEvent): CanvasPoint {
    const rect = this.options.el.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,

      y: event.clientY - rect.top,
    };
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    return isCanvasUiTarget(target);
  }

  private onGestureStart = (event: Event): void => {
    event.preventDefault();
    this.gestureStartScale = this.options.controller.viewportScale;
  };

  private onGestureChange = (event: Event): void => {
    event.preventDefault();
    const gesture = event as SafariGestureEvent;
    const rect = this.options.el.getBoundingClientRect();
    const point: CanvasPoint = {
      x: gesture.clientX - rect.left,

      y: gesture.clientY - rect.top,
    };

    this.options.controller.setZoomAt(point, this.gestureStartScale * gesture.scale);
  };

  private onGestureEnd = (event: Event): void => {
    event.preventDefault();
    this.options.controller.endGesture?.();
    this.gestureStartScale = 1;
  };
}
