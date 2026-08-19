import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@productivity-suite/shared-ui";
import { CanvasLoadingScreen } from "@/components/canvas/CanvasLoadingScreen";
import { CanvasToast } from "@/components/canvas/CanvasToast";
import type { CanvasRuntimeDependencies, CanvasUiController } from "@/components/canvas/ui/CanvasUiController";
import {
  canvasPersistenceStore,
  useCanvasApiConnected,
  useCanvasCards,
  useCanvasSaveState,
  useCanvasSelection,
} from "@/features/canvas/store/canvasPersistenceStore";
import { CanvasEngine } from "@/features/canvas/engine";
import type { CanvasPreferences } from "@/features/canvas/preferences";
import { mountEndlessCanvasRuntime, type CanvasRuntimeDocument } from "./EndlessCanvasRuntime";

type TooltipState = { label: string; x: number; y: number };
type ToastState = { id: string; message: string };

export type EndlessCanvasProps = PropsWithChildren<{
  algorithms: CanvasRuntimeDependencies;
  ui: CanvasUiController;
  gridSize: CanvasPreferences["gridSize"];
  gridStyle: CanvasPreferences["gridStyle"];
  theme: CanvasPreferences["theme"];
  background: CanvasPreferences["background"];
  gridOpacity: CanvasPreferences["gridOpacity"];
  metadata: CanvasPreferences["metadata"];
  onActivatePreferences: (boardId: string) => CanvasPreferences;
  onPreferencesChange: (boardId: string, preferences: CanvasPreferences) => void;
}>;

export function EndlessCanvas({ algorithms, ui, gridSize, gridStyle, theme, background, gridOpacity, metadata, onActivatePreferences, onPreferencesChange, children }: EndlessCanvasProps) {
  const engine = useMemo(() => new CanvasEngine(), []);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const cards = useCanvasCards();
  const selection = useCanvasSelection();
  const apiConnected = useCanvasApiConnected();
  const saveState = useCanvasSaveState();
  const documentState = useMemo<CanvasRuntimeDocument>(() => ({
    cards: canvasPersistenceStore.cards,
    links: canvasPersistenceStore.links,
    primaryCard: canvasPersistenceStore.primaryCard,
    selectedCardIds: canvasPersistenceStore.selectedCardIds,
    selectedLinkIds: canvasPersistenceStore.selectedLinkIds,
    selectedElementIds: canvasPersistenceStore.selectedElementIds,
    selectedElementArrowIds: canvasPersistenceStore.selectedElementArrowIds,
    hydrate: (nextCards, nextLinks) => canvasPersistenceStore.hydrate(nextCards, nextLinks),
    commit: (origin) => canvasPersistenceStore.commit(origin),
    snapshotCards: () => canvasPersistenceStore.cardsFromY(),
    snapshotLinks: () => canvasPersistenceStore.linksFromY(),
    undo: () => canvasPersistenceStore.undo(),
    redo: () => canvasPersistenceStore.redo(),
    beginUndoGroup: () => canvasPersistenceStore.beginUndoGroup(),
    canUndo: () => canvasPersistenceStore.canUndo(),
    canRedo: () => canvasPersistenceStore.canRedo(),
    setCards: (nextCards) => canvasPersistenceStore.setCards(nextCards),
    setLinks: (nextLinks) => canvasPersistenceStore.setLinks(nextLinks),
    selectCards: (ids) => canvasPersistenceStore.selectCards(ids),
    selectLinks: (ids) => canvasPersistenceStore.selectLinks(ids),
    restoreSelection: (selectionState) => canvasPersistenceStore.restoreSelection(selectionState),
    configureSync: (context) => canvasPersistenceStore.configurePersistence(context),
    scheduleSync: (delay, commit) => canvasPersistenceStore.queueSave(delay, commit),
    flushSync: () => canvasPersistenceStore.flushSave(),
  }), []);
  const preferences = useMemo<CanvasPreferences>(() => ({ gridSize, gridStyle, theme, background, gridOpacity, metadata }), [background, gridOpacity, gridSize, gridStyle, metadata, theme]);
  const preferenceProps = useRef({ preferences, onActivatePreferences, onPreferencesChange });
  preferenceProps.current = { preferences, onActivatePreferences, onPreferencesChange };
  const preferenceListeners = useRef(new Set<(value: CanvasPreferences) => void>());
  const preferenceBridge = useMemo(() => ({
    current: () => preferenceProps.current.preferences,
    activateBoard: (boardId: string) => preferenceProps.current.onActivatePreferences(boardId),
    change: (boardId: string, value: CanvasPreferences) => preferenceProps.current.onPreferencesChange(boardId, value),
    subscribe: (listener: (value: CanvasPreferences) => void) => {
      preferenceListeners.current.add(listener);
      return () => preferenceListeners.current.delete(listener);
    },
  }), []);

  useEffect(() => {
    for (const listener of preferenceListeners.current) listener(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!host) return;
    let disposed = false;
    let disposeEngine: (() => void) | undefined;
    void mountEndlessCanvasRuntime(host, {
      engine,
      document: documentState,
      algorithms,
      ui,
      preferences: preferenceBridge,
      onError: (message) => setToasts((current) => [...current, { id: crypto.randomUUID(), message }]),
    }).then((dispose) => {
      disposeEngine = dispose;
      if (disposed) dispose();
      else setLoading(false);
    });
    return () => {
      disposed = true;
      disposeEngine?.();
    };
  }, [algorithms, documentState, engine, host, preferenceBridge, ui]);

  const targetFrom = (value: EventTarget | null) => value instanceof Element
    ? value.closest<HTMLElement>("[title], [data-tooltip]")
    : null;

  const showTooltip = (target: HTMLElement) => {
    const label = target.dataset.tooltip || target.getAttribute("title") || "";
    if (!label) return;
    target.dataset.tooltip = label;
    target.removeAttribute("title");
    const bounds = target.getBoundingClientRect();
    setTooltip({ label, x: bounds.left + bounds.width / 2, y: bounds.top - 8 });
  };

  return (
    <Tooltip open={Boolean(tooltip)}>
      <TooltipTrigger asChild>
        <div
          ref={setHost}
          className={`canvas-host${preferences.theme === "dark" ? " dark" : ""}`}
          style={{ background: `#${preferences.background.toString(16).padStart(6, "0")}` }}
          data-api-connected={apiConnected}
          data-save-state={saveState}
          data-card-count={cards.length}
          data-selected-card-count={selection.cardIds.length}
          onPointerOver={(event) => { const target = targetFrom(event.target); if (target) showTooltip(target); }}
          onPointerOut={(event) => { if (targetFrom(event.target) !== targetFrom(event.relatedTarget)) setTooltip(null); }}
          onFocus={(event) => { const target = targetFrom(event.target); if (target) showTooltip(target); }}
          onBlur={() => setTooltip(null)}
        >
          {children}
          {loading && <CanvasLoadingScreen />}
          <div className="toast-host">
            {toasts.map((toast) => (
              <CanvasToast
                key={toast.id}
                message={toast.message}
                onDismiss={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              />
            ))}
          </div>
        </div>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent
          side="top"
          style={{ position: "fixed", left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip.label}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
