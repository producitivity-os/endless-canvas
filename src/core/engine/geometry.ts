import type { ResizeCorner, CanvasPoint } from "../types";
import type { Bounds } from "./spatial";

export function resizeBoundsFromCorner(
  corner: ResizeCorner,
  origin: Bounds,
  point: CanvasPoint,
  minWidth: number,
  minHeight: number,
  preserveAspectRatio = false,
): Bounds {
  const left = origin.x;
  const top = origin.y;
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  switch (corner) {
    case "topLeft":
      nextLeft = point.x;
      nextTop = point.y;
      break;

    case "topRight":
      nextRight = point.x;
      nextTop = point.y;
      break;

    case "bottomRight":
      nextRight = point.x;
      nextBottom = point.y;
      break;

    case "bottomLeft":
      nextLeft = point.x;
      nextBottom = point.y;
      break;
  }

  let width = Math.abs(nextRight - nextLeft);

  let height = Math.abs(nextBottom - nextTop);

  if (preserveAspectRatio) {
    const aspect = origin.width / Math.max(origin.height, 0.001);

    if (width / Math.max(height, 0.001) > aspect) {
      height = width / aspect;
    } else {
      width = height * aspect;
    }
  }

  width = Math.max(minWidth, width);

  height = Math.max(minHeight, height);

  const draggingLeft = corner === "topLeft" || corner === "bottomLeft";

  const draggingTop = corner === "topLeft" || corner === "topRight";

  const x = draggingLeft ? right - width : left;

  const y = draggingTop ? bottom - height : top;

  return {
    x,
    y,
    width,
    height,
  };
}
