import type { CanvasOverviewSnapshot } from "../engine";

type FrameHandle = number | ReturnType<typeof setTimeout>;

export class CanvasOverviewPublisher {
  private frame: FrameHandle | null = null;
  private destroyed = false;
  private lastSignature = "";
  private readonly createSnapshot: () => CanvasOverviewSnapshot;
  private readonly publish?: (snapshot: CanvasOverviewSnapshot) => void;

  constructor(
    createSnapshot: () => CanvasOverviewSnapshot,
    publish?: (snapshot: CanvasOverviewSnapshot) => void,
  ) {
    this.createSnapshot = createSnapshot;
    this.publish = publish;
  }

  schedule(): void {
    if (!this.publish || this.destroyed || this.frame !== null) return;
    if (typeof requestAnimationFrame === "function") {
      this.frame = requestAnimationFrame(() => this.flush());
      return;
    }
    this.frame = setTimeout(() => this.flush(), 0);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.frame === null) return;
    if (typeof cancelAnimationFrame === "function" && typeof this.frame === "number") {
      cancelAnimationFrame(this.frame);
    } else {
      clearTimeout(this.frame);
    }
    this.frame = null;
  }

  private flush(): void {
    this.frame = null;
    if (this.destroyed || !this.publish) return;
    const snapshot = this.createSnapshot();
    const signature = JSON.stringify(snapshot);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.publish(snapshot);
  }
}
