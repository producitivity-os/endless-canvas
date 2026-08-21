import { useEffect, useRef } from "react";

import {
  CanvasEngine,
  CanvasController,
  type EndlessCanvasState,
  CanvasInteractionController,
  CanvasSelectionController,
  CanvasSelectionState,
  type EndlessCanvasOptions,
  EndlessCanvasRuntimeState,
} from "../core";
import type { CanvasTool } from "../../playground/components/Toolbar";

export interface EndlessCanvasProps {
  initialState?: EndlessCanvasState;

  onChange?: (state: EndlessCanvasState) => void;
  onError?: (error: unknown) => void;
  mode: CanvasTool;

  className?: string;

  style?: React.CSSProperties;
  options: EndlessCanvasOptions;
}

export function EndlessCanvas({ initialState, onChange, className, style }: EndlessCanvasProps) {
  const selectionState = new CanvasSelectionState();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;

    if (!el) {
      return;
    }

    const state: EndlessCanvasState = {
      cards: initialState?.cards ?? [],
      links: initialState?.links ?? [],
    };

    const runtime = new EndlessCanvasRuntimeState();

    const engine = new CanvasEngine();

    let controller: CanvasController | undefined;

    let interactions: CanvasInteractionController | undefined;

    let disposed = false;

    void engine.initialize(el).then(() => {
      if (disposed) {
        engine.destroy();
        return;
      }

      const selection = new CanvasSelectionController(runtime.selection);

      controller = new CanvasController({
        runtime,
        selection,
        engine,
        state,

        onChange: () => {
          onChange?.(state);
        },
      });

      interactions = new CanvasInteractionController({
        el,
        controller,
      });

      interactions.attach();

      controller.render();
      engine.show();
    });

    return () => {
      disposed = true;

      interactions?.detach();
      engine.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
