import type {
  CanvasCardObject,
  CanvasObject,
  CanvasObjectCapabilities,
  CanvasObjectCapabilityDefaults,
} from "../model/index.ts";

export class CanvasObjectCapabilityPolicy {
  private readonly defaults: CanvasObjectCapabilityDefaults;

  constructor(defaults: CanvasObjectCapabilityDefaults = {}) {
    this.defaults = defaults;
  }

  apply(object: CanvasObject): void {
    object.capabilities = this.resolve(object);
    if (object.type !== "card") return;
    for (const child of (object as CanvasCardObject).elements) this.apply(child);
  }

  private resolve(object: CanvasObject): CanvasObjectCapabilities {
    const configured = this.defaults[object.type];
    return {
      rotatable: configured?.rotatable ?? object.capabilities?.rotatable ?? true,
      movable: configured?.movable ?? object.capabilities?.movable ?? true,
      resizable: configured?.resizable ?? object.capabilities?.resizable ?? true,
      deletable: configured?.deletable ?? object.capabilities?.deletable ?? true,
      copyable: configured?.copyable ?? object.capabilities?.copyable ?? true,
      connectable: configured?.connectable ?? object.capabilities?.connectable ?? true,
      showConnectionHandles:
        configured?.showConnectionHandles ?? object.capabilities?.showConnectionHandles ?? false,
    };
  }
}
