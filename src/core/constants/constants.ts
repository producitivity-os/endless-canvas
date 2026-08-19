import type { CanvasCard, CanvasType } from "../model/model";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8788";

export const CANVAS_TYPE_OPTIONS: Array<{ value: CanvasType; label: string; description: string }> = [
  { value: "basic", label: "Basic", description: "A flexible blank canvas." },
  { value: "flowchart", label: "Flowchart", description: "Organize processes and connected steps." },
  { value: "mind-map", label: "Mind map", description: "Explore ideas around a central topic." },
];

export const CARD_FILL = 0xffffff;
export const CARD_STROKE = 0xd9dee8;
export const CARD_SELECTED = 0x8b5cf6;
export const INITIAL_CARDS: CanvasCard[] = [];
