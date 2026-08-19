
export interface CanvasHealthStatus {
  healthy: boolean;
}

export interface CanvasBoard {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
}


export type CanvasCardInit = {
  id: string;
  kind?: "text";
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasElement[];
  arrows?: ElementArrow[];
  backgroundColor?: number;
  locked?: boolean;
};
