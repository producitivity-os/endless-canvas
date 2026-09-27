export class CanvasHostResize {
  private readonly observer: ResizeObserver;
  private frame: number | null = null;

  constructor(host: HTMLElement, onResize: () => void) {
    this.observer = new ResizeObserver(() => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        onResize();
      });
    });
    this.observer.observe(host);
  }

  destroy(): void {
    this.observer.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
