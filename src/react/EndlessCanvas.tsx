import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  CanvasEngine,
  CanvasController,
  type EndlessCanvasState,
  CanvasInteractionController,
  CanvasSelectionController,
  CanvasImagePicker,
  CanvasInlineTextEditor,
  type EndlessCanvasOptions,
  EndlessCanvasRuntimeState,
  type CanvasTool,
  type CanvasPropertyContext,
  type CanvasPropertyPatch,
  type CanvasPaneChangeListener,
  canvasObjectFactory,
} from "../core";

export interface CanvasPropertiesSlotProps {
  context: CanvasPropertyContext;
  onPatch(patch: CanvasPropertyPatch): void;
}

export interface EndlessCanvasProps {
  initialState?: EndlessCanvasState;

  onChange?: (state: EndlessCanvasState) => void;
  onError?: (error: unknown) => void;
  onPaneChange?: CanvasPaneChangeListener;
  tool: CanvasTool;

  className?: string;

  style?: React.CSSProperties;
  options: EndlessCanvasOptions;
  propertiesSlot?: (props: CanvasPropertiesSlotProps) => ReactNode;
}

export function EndlessCanvas({
  initialState,
  onChange,
  className,
  style,
  tool,
  options,
  onError,
  onPaneChange,
  propertiesSlot,
}: EndlessCanvasProps) {
  // const selectionState = new CanvasSelectionState();
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CanvasController | null>(null);
  const latestToolRef = useRef(tool);
  const [propertiesContext, setPropertiesContext] = useState<CanvasPropertyContext>({
    mode: "none",
    tool,
    selectionCount: 0,
    fields: [],
  });
  const [patchProperties, setPatchProperties] = useState<(patch: CanvasPropertyPatch) => void>(
    () => () => undefined,
  );

  useEffect(() => {
    const el = hostRef.current;

    if (!el) {
      return;
    }

    const state: EndlessCanvasState = {
      objects: (initialState?.objects ?? options.initialState?.objects ?? []).map((object) =>
        canvasObjectFactory.hydrate(object),
      ),
    };

    const runtime = new EndlessCanvasRuntimeState();
    runtime.tool = latestToolRef.current;

    const engine = new CanvasEngine();

    let controller: CanvasController | undefined;

    let interactions: CanvasInteractionController | undefined;
    const textEditor = new CanvasInlineTextEditor(el);
    const imagePicker = new CanvasImagePicker(el);

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
        onError: onError ?? options.onError,
        requestText: (request) => textEditor.edit(request),
        cancelTextEditing: () => textEditor.cancel(),
        commitTextEditing: () => textEditor.commit(),
        requestImage: () => imagePicker.pick(),
        uploadImage: options.assets?.uploadImage.bind(options.assets),
        onCropRequest: options.onCropRequest,
        defaultTextFormat: options.defaultTextFormat,
        onPropertiesChange: setPropertiesContext,
        maxPaneDepth: options.maxPaneDepth,
        onPaneChange: onPaneChange ?? options.onPaneChange,
        onChange: () => {
          (onChange ?? options.onChange)?.(state);
        },
      });
      controllerRef.current = controller;
      setPatchProperties(() => (patch: CanvasPropertyPatch) => {
        controller?.applyPropertyPatch(patch);
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
      controller?.destroy();
      controllerRef.current = null;
      textEditor.destroy();
      imagePicker.destroy();
      engine.destroy();
    };
  }, [
    initialState?.objects,
    onChange,
    onError,
    onPaneChange,
    options.assets,
    options.initialState?.objects,
    options.onChange,
    options.onError,
    options.onPaneChange,
    options.onCropRequest,
    options.defaultTextFormat,
    options.maxPaneDepth,
  ]);

  useEffect(() => {
    latestToolRef.current = tool;
    controllerRef.current?.setTool(tool);
  }, [tool]);

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
    >
      {propertiesSlot?.({ context: propertiesContext, onPatch: patchProperties })}
    </div>
  );
}
