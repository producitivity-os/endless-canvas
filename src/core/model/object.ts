import type { CanvasPoint } from "../types";

export type BuiltinCanvasObjectType =
  | "rect"
  | "card"
  | "ellipse"
  | "diamond"
  | "pentagon"
  | "parallelogram"
  | "image"
  | "path"
  | "arrow"
  | "text"
  | "video";

/** Built-in types remain discoverable while applications may register their own string types. */
export type CanvasObjectType = BuiltinCanvasObjectType | (string & {});

export interface CanvasObjectCapabilities {
  rotatable: boolean;
  movable: boolean;
  resizable: boolean;
  deletable: boolean;
  copyable: boolean;
  connectable: boolean;
  showConnectionHandles: boolean;
}

export type CanvasObjectCapabilityDefaults = Partial<
  Record<CanvasObjectType, Partial<CanvasObjectCapabilities>>
>;

export interface CanvasObjectInit {
  id: string;
  /** The top-level canvas layer containing this object. */
  layerId?: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  capabilities?: Partial<CanvasObjectCapabilities>;
}

export abstract class CanvasObject {
  abstract readonly type: CanvasObjectType;
  id: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  capabilities: CanvasObjectCapabilities;

  protected constructor(init: CanvasObjectInit) {
    this.id = init.id;
    this.layerId = init.layerId ?? "main";
    this.x = init.x;
    this.y = init.y;
    this.width = init.width;
    this.height = init.height;
    this.rotation = init.rotation ?? 0;
    this.opacity = init.opacity ?? 1;
    this.capabilities = {
      rotatable: init.capabilities?.rotatable ?? true,
      movable: init.capabilities?.movable ?? true,
      resizable: init.capabilities?.resizable ?? true,
      deletable: init.capabilities?.deletable ?? true,
      copyable: init.capabilities?.copyable ?? true,
      connectable: init.capabilities?.connectable ?? true,
      showConnectionHandles: init.capabilities?.showConnectionHandles ?? false,
    };
  }

  moveTo(point: CanvasPoint) {
    this.x = point.x;
    this.y = point.y;
  }
  translate(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }
  bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
