import { CANVAS_TYPE_OPTIONS } from "../constants/constants";
import { defaultCanvasMetadata, type CanvasGridStyle, type CanvasMetadata, type CanvasTheme } from "../model/canvas";
import type { EndlessCanvasRuntimeOptions } from "../types/runtime";

export type CanvasPreferences = {
  gridSize: number;
  gridStyle: CanvasGridStyle;
  theme: CanvasTheme;
  background: number;
  gridOpacity: number;
  metadata: CanvasMetadata;
};

export const defaultCanvasPreferences = (): CanvasPreferences => ({
  gridSize: 32,
  gridStyle: "lines",
  theme: "light",
  background: 0xf4f6f8,
  gridOpacity: 0.72,
  metadata: defaultCanvasMetadata(),
});

const keyFor = (boardId: string) => `productivity-canvas:appearance:${boardId || "default"}`;

export function loadCanvasPreferences(boardId: string): CanvasPreferences {
  const fallback = defaultCanvasPreferences();
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(boardId)) || "{}") as Partial<CanvasPreferences>;
    const layers = saved.metadata?.layers?.length ? saved.metadata.layers : fallback.metadata.layers;
    const type = CANVAS_TYPE_OPTIONS.some(({ value }) => value === saved.metadata?.type)
      ? saved.metadata!.type
      : fallback.metadata.type;
    return {
      gridSize: [16, 32, 64].includes(saved.gridSize ?? 0) ? saved.gridSize! : fallback.gridSize,
      gridStyle: saved.gridStyle === "dots" || saved.gridStyle === "none" ? saved.gridStyle : "lines",
      theme: saved.theme === "dark" ? "dark" : "light",
      background: Number.isFinite(saved.background) ? saved.background! : fallback.background,
      gridOpacity: Number.isFinite(saved.gridOpacity) ? Math.max(0.1, Math.min(1, saved.gridOpacity!)) : fallback.gridOpacity,
      metadata: {
        type,
        description: saved.metadata?.description ?? "",
        layers,
        activeLayerId: layers.some(({ id }) => id === saved.metadata?.activeLayerId)
          ? saved.metadata!.activeLayerId
          : layers[0].id,
      },
    };
  } catch {
    return fallback;
  }
}

export function saveCanvasPreferences(boardId: string, preferences: CanvasPreferences) {
  localStorage.setItem(keyFor(boardId), JSON.stringify(preferences));
}
export class CanvasPreferencesController {
  private value: CanvasPreferences;

  private readonly store: EndlessCanvasRuntimeOptions["preferences"];
  constructor(
    store: EndlessCanvasRuntimeOptions["preferences"]
  ) {
    this.store = store
    this.value = store.current();
  }

  get current(): Readonly<CanvasPreferences> {
    return this.value;
  }

  activate(boardId: string): void {
    this.value = this.store.activateBoard(boardId);
  }

  save(boardId: string): void {
    this.store.change(boardId, this.value);
  }

  set(
    preferences: CanvasPreferences,
  ): void {
    this.value = preferences;
  }

  update(
    changes: Partial<CanvasPreferences>,
  ): void {
    this.value = {
      ...this.value,
      ...changes,
    };
  }
}
