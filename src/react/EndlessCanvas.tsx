import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  type CanvasLayer,
  type CanvasObject,
  type CanvasContextTarget,
  type CanvasPoint,
  type CanvasSelectionChange,
  type CanvasHistoryState,
  type CanvasOverviewSnapshot,
  type CanvasViewportFitOptions,
  normalizeCanvasLayers,
  canvasObjectFactory,
} from "../core";
import { subscribeImageRenderer } from "../core/model/image/utils";
import { CanvasHostResize } from "./canvas-host-resize";

export interface CanvasPropertiesSlotProps {
  context: CanvasPropertyContext;
  selection: CanvasSelectionChange;
  onPatch(patch: CanvasPropertyPatch): void;
  updateObject(objectId: string, patch: Partial<CanvasObject>): boolean;
  updateObjects(updates: readonly { objectId: string; patch: Partial<CanvasObject> }[]): number;
  beginMutation(): void;
  commitMutation(): boolean;
  cancelMutation(): void;
}

export interface CanvasLayerView extends CanvasLayer {
  elements: readonly CanvasObject[];
}

export interface CanvasLayersSlotProps {
  layers: readonly CanvasLayerView[];
  activeLayerId: string;
  focusedLayerId: string | null;
  unfocusedLayerOpacity: number;
  createLayer(name?: string, values?: Partial<Omit<CanvasLayer, "id">>): CanvasLayer | null;
  updateLayer(id: string, patch: Partial<Omit<CanvasLayer, "id">>): boolean;
  moveLayer(id: string, toIndex: number): boolean;
  deleteLayer(id: string): boolean;
  setActiveLayer(id: string): boolean;
  setFocusedLayer(id: string | null): boolean;
  setUnfocusedLayerOpacity(opacity: number): void;
}

export interface CanvasObjectOverlaySlotProps {
  object: CanvasObject;
  viewport: NonNullable<EndlessCanvasState["viewport"]>;
  getObjects(): readonly CanvasObject[];
  update(patch: Partial<CanvasObject>): boolean;
  updateObjects(updates: readonly { objectId: string; patch: Partial<CanvasObject> }[]): number;
  beginMutation(): void;
  commitMutation(): boolean;
  cancelMutation(): void;
}

export interface EndlessCanvasProps {
  initialState?: EndlessCanvasState;

  onChange?: (state: EndlessCanvasState) => void;
  onError?: (error: unknown) => void;
  onPaneChange?: CanvasPaneChangeListener;
  onLayersChange?: (layers: CanvasLayersSlotProps) => void;
  onViewportChange?: (viewport: EndlessCanvasState["viewport"]) => void;
  onToolChangeRequest?: (tool: CanvasTool) => void;
  onHistoryChange?: (state: CanvasHistoryState) => void;
  onReady?: () => void;
  tool: CanvasTool;

  className?: string;

  style?: React.CSSProperties;
  options: EndlessCanvasOptions;
  propertiesSlot?: (props: CanvasPropertiesSlotProps) => ReactNode;
  layersSlot?: (props: CanvasLayersSlotProps) => ReactNode;
  objectOverlaySlot?: (props: CanvasObjectOverlaySlotProps) => ReactNode;
}

export interface CaptureSnapshotOptions {
  format?: "png" | "jpeg";
  quality?: number;
  resolution?: number;
}

export interface EndlessCanvasHandle {
  captureSnapshot(options?: CaptureSnapshotOptions): Promise<string>;
  insertImage(): void;
  insertVideo(): void;
  insertObject(object: CanvasObject, select?: boolean): CanvasObject | null;
  removeObjects(objectIds: readonly string[]): number;
  focusObject(objectId: string): boolean;
  updateObject(objectId: string, patch: Partial<CanvasObject>): boolean;
  updateObjects(updates: readonly { objectId: string; patch: Partial<CanvasObject> }[]): number;
  requestRender(): void;
  getViewportCenter(): CanvasPoint;
  getZoom(): number;
  setZoom(zoom: number): number;
  zoomBy(delta: number): number;
  fitAllVisible(options?: CanvasViewportFitOptions): boolean;
  setViewportCenter(point: CanvasPoint): void;
  subscribeOverview(listener: (snapshot: CanvasOverviewSnapshot) => void): () => void;
  getLayers(): readonly CanvasLayerView[];
  createLayer(name?: string, values?: Partial<Omit<CanvasLayer, "id">>): CanvasLayer | null;
  updateLayer(id: string, patch: Partial<Omit<CanvasLayer, "id">>): boolean;
  moveLayer(id: string, toIndex: number): boolean;
  deleteLayer(id: string): boolean;
  setActiveLayer(id: string): boolean;
  setFocusedLayer(id: string | null): boolean;
  setUnfocusedLayerOpacity(opacity: number): void;
  getState(): EndlessCanvasState | null;
  prepareContextMenu(point: CanvasPoint): CanvasContextTarget;
  copySelection(): Promise<boolean>;
  cutSelection(): Promise<boolean>;
  pasteClipboard(point?: CanvasPoint): Promise<boolean>;
  deleteSelection(): boolean;
  editObject(id: string): boolean;
  exitPane(): boolean;
  fitCardToContent(id: string): boolean;
  fitObjectToContent(id: string): boolean;
  cropImage(id: string): boolean;
  toggleVideo(id: string): Promise<boolean>;
  undo(): boolean;
  redo(): boolean;
  getHistoryState(): CanvasHistoryState;
}

const layerViews = (state: EndlessCanvasState): CanvasLayerView[] =>
  normalizeCanvasLayers(state).map((layer) => ({
    ...layer,
    elements: state.objects.filter((object) => object.layerId === layer.id),
  }));

type EngineWaiter = {
  resolve(engine: CanvasEngine): void;
  reject(error: unknown): void;
};

export const EndlessCanvas = forwardRef<EndlessCanvasHandle, EndlessCanvasProps>(
  function EndlessCanvas(
    {
      initialState,
      onChange,
      className,
      style,
      tool,
      options,
      onError,
      onPaneChange,
      onLayersChange,
      onViewportChange,
      onToolChangeRequest,
      onHistoryChange,
      onReady,
      propertiesSlot,
      layersSlot,
      objectOverlaySlot,
    },
    ref,
  ) {
    // const selectionState = new CanvasSelectionState();
    const hostRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<CanvasController | null>(null);
    const engineRef = useRef<CanvasEngine | null>(null);
    const engineWaitersRef = useRef<EngineWaiter[]>([]);
    const overviewRef = useRef<CanvasOverviewSnapshot | null>(null);
    const overviewListenersRef = useRef(new Set<(snapshot: CanvasOverviewSnapshot) => void>());
    const latestToolRef = useRef(tool);
    const stateRef = useRef<EndlessCanvasState | null>(null);
    const onReadyRef = useRef(onReady);
    const callbacksRef = useRef({
      onChange,
      onError,
      onPaneChange,
      onLayersChange,
      onViewportChange,
      onToolChangeRequest,
      onHistoryChange,
      options,
    });
    callbacksRef.current = {
      onChange,
      onError,
      onPaneChange,
      onLayersChange,
      onViewportChange,
      onToolChangeRequest,
      onHistoryChange,
      options,
    };
    const hasConnectionDrop = Boolean(options.onConnectionDrop);
    const hasAddToolPlacement = Boolean(options.onAddToolPlacement);
    const hasAddToolDraw = Boolean(options.onAddToolDraw);
    const hasArrowDefaultsResolver = Boolean(options.resolveArrowDefaults);
    const [, setLayersVersion] = useState(0);
    const [propertiesContext, setPropertiesContext] = useState<CanvasPropertyContext>({
      mode: "none",
      tool,
      selectionCount: 0,
      fields: [],
    });
    const [patchProperties, setPatchProperties] = useState<(patch: CanvasPropertyPatch) => void>(
      () => () => undefined,
    );
    const [selection, setSelection] = useState<CanvasSelectionChange>({
      selectedIds: [],
      selectedObjects: [],
      primaryObject: null,
      viewport: { x: 0, y: 0, scale: 1 },
    });

    useEffect(() => {
      onReadyRef.current = onReady;
    }, [onReady]);

    const layerActions = (): CanvasLayersSlotProps => {
      const state = stateRef.current ?? { objects: [] };
      const controller = controllerRef.current;
      normalizeCanvasLayers(state);
      return {
        layers: layerViews(state),
        activeLayerId: state.activeLayerId!,
        focusedLayerId: state.focusedLayerId ?? null,
        unfocusedLayerOpacity: state.unfocusedLayerOpacity ?? 0.24,
        createLayer: (name, values) => controller?.createLayer(name, values) ?? null,
        updateLayer: (id, patch) => controller?.updateLayer(id, patch) ?? false,
        moveLayer: (id, toIndex) => controller?.moveLayer(id, toIndex) ?? false,
        deleteLayer: (id) => controller?.deleteLayer(id) ?? false,
        setActiveLayer: (id) => controller?.setActiveLayer(id) ?? false,
        setFocusedLayer: (id) => controller?.setFocusedLayer(id) ?? false,
        setUnfocusedLayerOpacity: (opacity) => controller?.setUnfocusedLayerOpacity(opacity),
      };
    };

    useImperativeHandle(
      ref,
      () => ({
        async captureSnapshot(snapshotOptions = {}) {
          let engine = engineRef.current;

          if (!engine) {
            engine = await new Promise<CanvasEngine>((resolve, reject) => {
              engineWaitersRef.current.push({ resolve, reject });
            });
          }

          const quality = Math.min(1, Math.max(0, snapshotOptions.quality ?? 0.82));
          const resolution = Math.max(0.25, snapshotOptions.resolution ?? 1);

          const controller = controllerRef.current;
          controller?.renderForSnapshot();
          try {
            return await engine.app.renderer.extract.base64({
              target: engine.app.stage,
              format: snapshotOptions.format === "jpeg" ? "jpg" : "png",
              quality,
              resolution,
              clearColor: "#f4f6f8",
              antialias: true,
            });
          } finally {
            controller?.render();
          }
        },
        insertImage: () => controllerRef.current?.insertImageAtViewportCenter(),
        insertVideo: () => controllerRef.current?.insertVideoAtViewportCenter(),
        insertObject: (object, select) =>
          controllerRef.current?.insertObject(object, select) ?? null,
        removeObjects: (objectIds) => controllerRef.current?.removeObjects(objectIds) ?? 0,
        focusObject: (objectId) => controllerRef.current?.focusObject(objectId) ?? false,
        updateObject: (objectId, patch) =>
          controllerRef.current?.updateObject(objectId, patch) ?? false,
        updateObjects: (updates) => controllerRef.current?.updateObjects(updates) ?? 0,
        requestRender: () => controllerRef.current?.render(),
        getViewportCenter: () => {
          const engine = engineRef.current;
          if (!engine) return { x: 0, y: 0 };
          const scale = engine.viewport.scale.x;
          return {
            x: (engine.app.screen.width / 2 - engine.viewport.x) / scale,
            y: (engine.app.screen.height / 2 - engine.viewport.y) / scale,
          };
        },
        getZoom: () => controllerRef.current?.viewportScale ?? 1,
        setZoom: (zoom) => controllerRef.current?.setZoomAtViewportCenter(zoom) ?? 1,
        zoomBy: (delta) => controllerRef.current?.zoomByAtViewportCenter(delta) ?? 1,
        fitAllVisible: (fitOptions) => controllerRef.current?.fitAllVisible(fitOptions) ?? false,
        setViewportCenter: (point) => controllerRef.current?.setViewportCenter(point),
        subscribeOverview: (listener) => {
          overviewListenersRef.current.add(listener);
          const snapshot = overviewRef.current;
          if (snapshot) listener(snapshot);
          return () => overviewListenersRef.current.delete(listener);
        },
        getLayers: () => (stateRef.current ? layerViews(stateRef.current) : []),
        createLayer: (name, values) => controllerRef.current?.createLayer(name, values) ?? null,
        updateLayer: (id, patch) => controllerRef.current?.updateLayer(id, patch) ?? false,
        moveLayer: (id, toIndex) => controllerRef.current?.moveLayer(id, toIndex) ?? false,
        deleteLayer: (id) => controllerRef.current?.deleteLayer(id) ?? false,
        setActiveLayer: (id) => controllerRef.current?.setActiveLayer(id) ?? false,
        setFocusedLayer: (id) => controllerRef.current?.setFocusedLayer(id) ?? false,
        setUnfocusedLayerOpacity: (opacity) =>
          controllerRef.current?.setUnfocusedLayerOpacity(opacity),
        getState: () => (stateRef.current ? structuredClone(stateRef.current) : null),
        prepareContextMenu: (point) =>
          controllerRef.current?.prepareContextMenu(point) ?? {
            kind: "empty",
            objectId: null,
            selectedIds: [],
            actions: ["paste"],
          },
        copySelection: () => controllerRef.current?.copySelection() ?? Promise.resolve(false),
        cutSelection: () => controllerRef.current?.cutSelection() ?? Promise.resolve(false),
        pasteClipboard: (point) =>
          controllerRef.current?.pasteClipboard(point) ?? Promise.resolve(false),
        deleteSelection: () => controllerRef.current?.deleteSelection() ?? false,
        editObject: (id) => controllerRef.current?.editObject(id) ?? false,
        exitPane: () => controllerRef.current?.exitPane() ?? false,
        fitCardToContent: (id) => controllerRef.current?.fitCardToContent(id) ?? false,
        fitObjectToContent: (id) => controllerRef.current?.fitObjectToContent(id) ?? false,
        cropImage: (id) => controllerRef.current?.cropImage(id) ?? false,
        toggleVideo: (id) => controllerRef.current?.toggleVideo(id) ?? Promise.resolve(false),
        undo: () => controllerRef.current?.undo() ?? false,
        redo: () => controllerRef.current?.redo() ?? false,
        getHistoryState: () =>
          controllerRef.current?.getHistoryState() ?? { canUndo: false, canRedo: false },
      }),
      [],
    );

    useEffect(() => {
      const el = hostRef.current;

      if (!el) {
        return;
      }

      for (const extension of options.objectExtensions ?? []) {
        canvasObjectFactory.register(extension.type, extension.hydrate);
      }
      const state: EndlessCanvasState = {
        objects: (initialState?.objects ?? options.initialState?.objects ?? []).map((object) =>
          canvasObjectFactory.hydrate(object),
        ),
        layers: structuredClone(initialState?.layers ?? options.initialState?.layers ?? []),
        activeLayerId: initialState?.activeLayerId ?? options.initialState?.activeLayerId,
        focusedLayerId: initialState?.focusedLayerId ?? options.initialState?.focusedLayerId,
        unfocusedLayerOpacity:
          initialState?.unfocusedLayerOpacity ?? options.initialState?.unfocusedLayerOpacity,
        viewport: structuredClone(initialState?.viewport ?? options.initialState?.viewport),
      };
      normalizeCanvasLayers(state);
      stateRef.current = state;

      const runtime = new EndlessCanvasRuntimeState();
      runtime.tool = latestToolRef.current;

      const engine = new CanvasEngine(
        options.objectExtensions,
        options.cardTemplates,
        options.pluginCards,
        options.gridStyle,
      );

      let controller: CanvasController | undefined;

      let interactions: CanvasInteractionController | undefined;
      let hostResize: CanvasHostResize | undefined;
      let unsubscribeTemplates: (() => void) | undefined;
      let unsubscribePlugins: (() => void) | undefined;
      let unsubscribeImages: (() => void) | undefined;
      const textEditor = new CanvasInlineTextEditor(el);
      const imagePicker = new CanvasImagePicker(el);

      let disposed = false;

      void engine
        .initialize(el)
        .then(() => {
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
            onError: (error) => {
              const latest = callbacksRef.current;
              (latest.onError ?? latest.options.onError)?.(error);
            },
            requestText: (request) => textEditor.edit(request),
            updateTextEditingLayout: (layout) => textEditor.updateLayout(layout),
            cancelTextEditing: () => textEditor.cancel(),
            commitTextEditing: () => textEditor.commit(),
            requestImage: options.assets?.pickImage
              ? () => options.assets!.pickImage!()
              : () => imagePicker.pick(),
            requestVideo: options.assets?.pickVideo
              ? () => options.assets!.pickVideo!()
              : undefined,
            uploadImage: options.assets?.uploadImage
              ? options.assets.uploadImage.bind(options.assets)
              : undefined,
            onCropRequest: (request) => callbacksRef.current.options.onCropRequest?.(request),
            defaultTextFormat: options.defaultTextFormat,
            onPropertiesChange: setPropertiesContext,
            maxPaneDepth: options.maxPaneDepth,
            onPaneChange: (context) => {
              const latest = callbacksRef.current;
              (latest.onPaneChange ?? latest.options.onPaneChange)?.(context);
            },
            onViewportChange: (viewport) => {
              const latest = callbacksRef.current;
              latest.onViewportChange?.(viewport);
              (latest.onChange ?? latest.options.onChange)?.(state);
            },
            onOverviewChange: (snapshot) => {
              overviewRef.current = snapshot;
              for (const listener of overviewListenersRef.current) listener(snapshot);
            },
            onToolRequest: (nextTool) => callbacksRef.current.onToolChangeRequest?.(nextTool),
            systemClipboard: options.clipboard,
            objectCapabilities: options.objectCapabilities,
            propertyDefaults: options.propertyDefaults,
            onConnectionDrop: hasConnectionDrop
              ? (request) => callbacksRef.current.options.onConnectionDrop?.(request) ?? null
              : undefined,
            onAddToolPlacement: hasAddToolPlacement
              ? (point) => callbacksRef.current.options.onAddToolPlacement?.(point) ?? null
              : undefined,
            onAddToolDraw: hasAddToolDraw
              ? (placement) => callbacksRef.current.options.onAddToolDraw?.(placement) ?? null
              : undefined,
            onExternalImagePaste: options.onExternalImagePaste
              ? (input, pane) =>
                  callbacksRef.current.options.onExternalImagePaste?.(input, pane) ?? null
              : undefined,
            resolveArrowDefaults: hasArrowDefaultsResolver
              ? (nextTool, pane) =>
                  callbacksRef.current.options.resolveArrowDefaults?.(nextTool, pane)
              : undefined,
            onObjectActivate: (object) => callbacksRef.current.options.onObjectActivate?.(object),
            onObjectClick: (object, context) =>
              callbacksRef.current.options.onObjectClick?.(object, context),
            shouldEnterCardPane: (card) =>
              callbacksRef.current.options.shouldEnterCardPane?.(card) ?? true,
            canInsertObject: (object, pane) =>
              callbacksRef.current.options.canInsertObject?.(object, pane) ?? true,
            onObjectCreate: (object, pane) =>
              callbacksRef.current.options.onObjectCreate?.(object, pane),
            onObjectDelete: (object, pane) =>
              callbacksRef.current.options.onObjectDelete?.(object, pane),
            onSelectionChange: (nextSelection) => {
              setSelection({
                ...nextSelection,
                selectedIds: [...nextSelection.selectedIds],
                selectedObjects: structuredClone(nextSelection.selectedObjects),
                primaryObject: nextSelection.primaryObject
                  ? structuredClone(nextSelection.primaryObject)
                  : null,
                viewport: { ...nextSelection.viewport },
              });
              callbacksRef.current.options.onSelectionChange?.(nextSelection);
            },
            onHistoryChange: (historyState) => {
              const latest = callbacksRef.current;
              (latest.onHistoryChange ?? latest.options.onHistoryChange)?.(historyState);
            },
            objectExtensions: options.objectExtensions,
            cardTemplates: options.cardTemplates,
            pluginCards: options.pluginCards,
            onChange: () => {
              const latest = callbacksRef.current;
              (latest.onChange ?? latest.options.onChange)?.(state);
              setLayersVersion((version) => version + 1);
              latest.onLayersChange?.(layerActions());
            },
          });
          controllerRef.current = controller;
          unsubscribeImages = subscribeImageRenderer({
            onChange: () => controller?.render(),
            onError: (message) => {
              const latest = callbacksRef.current;
              (latest.onError ?? latest.options.onError)?.(message);
            },
          });
          unsubscribeTemplates = options.cardTemplates?.subscribe?.(() => {
            controller?.refreshCardTemplates();
          });
          unsubscribePlugins = options.pluginCards?.subscribe?.(() => {
            controller?.refreshCardTemplates();
          });
          setPatchProperties(() => (patch: CanvasPropertyPatch) => {
            controller?.applyPropertyPatch(patch);
          });

          interactions = new CanvasInteractionController({
            el,
            controller,
          });

          interactions.attach();

          controller.render();
          hostResize = new CanvasHostResize(el, () => {
            engine.resize();
            controller?.render();
          });
          setLayersVersion((version) => version + 1);
          callbacksRef.current.onLayersChange?.(layerActions());
          engine.show();
          engineRef.current = engine;
          onReadyRef.current?.();
          for (const waiter of engineWaitersRef.current.splice(0)) {
            waiter.resolve(engine);
          }
        })
        .catch((error: unknown) => {
          for (const waiter of engineWaitersRef.current.splice(0)) {
            waiter.reject(error);
          }
          const latest = callbacksRef.current;
          (latest.onError ?? latest.options.onError)?.(error);
        });

      return () => {
        disposed = true;

        interactions?.detach();
        hostResize?.destroy();
        unsubscribeTemplates?.();
        unsubscribePlugins?.();
        unsubscribeImages?.();
        controller?.destroy();
        controllerRef.current = null;
        engineRef.current = null;
        stateRef.current = null;
        overviewRef.current = null;
        for (const waiter of engineWaitersRef.current.splice(0)) {
          waiter.reject(new Error("Canvas was disposed before it finished initializing."));
        }
        textEditor.destroy();
        imagePicker.destroy();
        engine.destroy();
      };
    }, [
      initialState?.objects,
      initialState?.layers,
      options.assets,
      options.clipboard,
      options.objectCapabilities,
      options.objectExtensions,
      options.cardTemplates,
      options.pluginCards,
      options.initialState?.objects,
      options.initialState?.layers,
      options.defaultTextFormat,
      options.onExternalImagePaste,
      options.maxPaneDepth,
      options.propertyDefaults,
      hasConnectionDrop,
      hasAddToolPlacement,
      hasAddToolDraw,
      hasArrowDefaultsResolver,
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
        {propertiesSlot?.({
          context: propertiesContext,
          selection,
          onPatch: patchProperties,
          updateObject: (objectId, patch) =>
            controllerRef.current?.updateObject(objectId, patch) ?? false,
          updateObjects: (updates) => controllerRef.current?.updateObjects(updates) ?? 0,
          beginMutation: () => controllerRef.current?.beginHistoryTransaction(),
          commitMutation: () => controllerRef.current?.commitHistoryTransaction() ?? false,
          cancelMutation: () => controllerRef.current?.cancelHistoryTransaction(),
        })}
        {layersSlot?.(layerActions())}
        {objectOverlaySlot && selection.primaryObject && selection.selectedIds.length === 1 && (
          <div
            data-canvas-interactive-overlay="true"
            style={{
              position: "absolute",
              left: selection.viewport.x + selection.primaryObject.x * selection.viewport.scale,
              top: selection.viewport.y + selection.primaryObject.y * selection.viewport.scale,
              width: selection.primaryObject.width * selection.viewport.scale,
              height: selection.primaryObject.height * selection.viewport.scale,
              transform: `rotate(${selection.primaryObject.rotation}rad)`,
              transformOrigin: "center",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            {objectOverlaySlot({
              object: selection.primaryObject,
              viewport: selection.viewport,
              getObjects: () => stateRef.current?.objects ?? [],
              update: (patch) =>
                controllerRef.current?.updateObject(selection.primaryObject!.id, patch) ?? false,
              updateObjects: (updates) => controllerRef.current?.updateObjects(updates) ?? 0,
              beginMutation: () => controllerRef.current?.beginHistoryTransaction(),
              commitMutation: () => controllerRef.current?.commitHistoryTransaction() ?? false,
              cancelMutation: () => controllerRef.current?.cancelHistoryTransaction(),
            })}
          </div>
        )}
      </div>
    );
  },
);
