import type { CanvasPoint, ResizeHandle } from "../types";
import type { Bounds } from "./spatial";

const MIN_DIMENSION = 0.001;

export class BoxGeometry {
  center(bounds: Bounds): CanvasPoint {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  rotatePoint(point: CanvasPoint, center: CanvasPoint, rotation: number): CanvasPoint {
    const rotated = this.rotateVector({ x: point.x - center.x, y: point.y - center.y }, rotation);

    return {
      x: center.x + rotated.x,
      y: center.y + rotated.y,
    };
  }

  containsPoint(bounds: Bounds, rotation: number, point: CanvasPoint): boolean {
    const localPoint = this.rotatePoint(point, this.center(bounds), -rotation);

    return (
      localPoint.x >= bounds.x &&
      localPoint.x <= bounds.x + bounds.width &&
      localPoint.y >= bounds.y &&
      localPoint.y <= bounds.y + bounds.height
    );
  }

  resize(
    handle: ResizeHandle,
    origin: Bounds,
    rotation: number,
    pointerOrigin: CanvasPoint,
    pointer: CanvasPoint,
    minWidth: number,
    minHeight: number,
    preserveAspectRatio = false,
  ): Bounds {
    const direction = this.handleDirection(handle);
    const center = this.center(origin);
    const initialHandle = this.rotatePoint(
      {
        x: center.x + (direction.x * origin.width) / 2,
        y: center.y + (direction.y * origin.height) / 2,
      },
      center,
      rotation,
    );
    const anchor = this.rotatePoint(
      {
        x: center.x - (direction.x * origin.width) / 2,
        y: center.y - (direction.y * origin.height) / 2,
      },
      center,
      rotation,
    );
    const draggedHandle = {
      x: initialHandle.x + pointer.x - pointerOrigin.x,
      y: initialHandle.y + pointer.y - pointerOrigin.y,
    };
    const localDelta = this.rotateVector(
      {
        x: draggedHandle.x - anchor.x,
        y: draggedHandle.y - anchor.y,
      },
      -rotation,
    );

    let width = direction.x === 0 ? origin.width : Math.max(0, direction.x * localDelta.x);
    let height = direction.y === 0 ? origin.height : Math.max(0, direction.y * localDelta.y);

    if (preserveAspectRatio) {
      const aspectRatio = origin.width / Math.max(origin.height, MIN_DIMENSION);
      const minimumHeight = Math.max(minHeight, minWidth / aspectRatio);

      if (direction.x === 0) {
        height = Math.max(minimumHeight, height);
      } else if (direction.y === 0) {
        height = Math.max(minimumHeight, width / aspectRatio);
      } else {
        const projectedHeight =
          (direction.x * aspectRatio * localDelta.x + direction.y * localDelta.y) /
          (aspectRatio * aspectRatio + 1);
        height = Math.max(minimumHeight, projectedHeight);
      }
      width = height * aspectRatio;
    } else {
      width = Math.max(minWidth, width);
      height = Math.max(minHeight, height);
    }

    const centerOffset = this.rotateVector(
      {
        x: (direction.x * width) / 2,
        y: (direction.y * height) / 2,
      },
      rotation,
    );
    const nextCenter = {
      x: anchor.x + centerOffset.x,
      y: anchor.y + centerOffset.y,
    };

    return {
      x: nextCenter.x - width / 2,
      y: nextCenter.y - height / 2,
      width,
      height,
    };
  }

  private handleDirection(handle: ResizeHandle): CanvasPoint {
    switch (handle) {
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
      case "top":
        return { x: 0, y: -1 };
      case "bottom":
        return { x: 0, y: 1 };
      case "topLeft":
        return { x: -1, y: -1 };
      case "topRight":
        return { x: 1, y: -1 };
      case "bottomRight":
        return { x: 1, y: 1 };
      case "bottomLeft":
        return { x: -1, y: 1 };
    }
  }

  private rotateVector(vector: CanvasPoint, rotation: number): CanvasPoint {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);

    return {
      x: vector.x * cosine - vector.y * sine,
      y: vector.x * sine + vector.y * cosine,
    };
  }
}

export const boxGeometry = new BoxGeometry();
