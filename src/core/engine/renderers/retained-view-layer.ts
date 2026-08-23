import { Container } from "pixi.js";

interface RetainedView<T> {
  container: Container;
  value: T;
}

export type RetainedViewDisposer<T> = (container: Container, value: T) => void;

export class RetainedViewLayer<T> {
  private readonly views = new Map<string, RetainedView<T>>();
  private readonly disposeView?: RetainedViewDisposer<T>;

  constructor(disposeView?: RetainedViewDisposer<T>) {
    this.disposeView = disposeView;
  }

  reconcile(
    layer: Container,
    values: readonly T[],
    idFor: (value: T) => string,
    render: (container: Container, value: T) => void,
  ): void {
    const active = new Set(values.map(idFor));
    for (const [id, view] of this.views) {
      if (active.has(id)) continue;
      this.destroyView(id, view);
    }

    for (const value of values) {
      const id = idFor(value);
      let view = this.views.get(id);
      if (!view) {
        view = { container: new Container(), value };
        this.views.set(id, view);
      }
      view.value = value;
      layer.addChild(view.container);
      render(view.container, value);
    }
  }

  clear(): void {
    for (const [id, view] of this.views) this.destroyView(id, view);
  }

  size(): number {
    return this.views.size;
  }

  private destroyView(id: string, view: RetainedView<T>): void {
    this.disposeView?.(view.container, view.value);
    view.container.removeFromParent();
    view.container.destroy({ children: true });
    this.views.delete(id);
  }
}
