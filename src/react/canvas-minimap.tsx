import * as React from "react";
import { Scan } from "lucide-react";
import { Button } from "@productivity-os/shared-ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@productivity-os/shared-ui/components/ui/tooltip";

import type { CanvasOverviewSnapshot, CanvasVisualBounds } from "../core";
import type { EndlessCanvasHandle } from "./EndlessCanvas";
import "./canvas-minimap.css";

const VIEWBOX_WIDTH = 180;
const VIEWBOX_HEIGHT = 120;
const MAP_PADDING = 9;
const CARD_RADIUS_PX = 3;
const CARD_MIN_SIZE_PX = 6;

interface MinimapProjection {
  readonly bounds: CanvasVisualBounds;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface MinimapDrag {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startCenter: { x: number; y: number };
  readonly clientScaleX: number;
  readonly clientScaleY: number;
  readonly projection: MinimapProjection;
}

export interface CanvasMinimapProps {
  canvasRef: React.RefObject<EndlessCanvasHandle | null>;
  className?: string;
}

function unionBounds(
  first: CanvasVisualBounds | null,
  second: CanvasVisualBounds,
): CanvasVisualBounds {
  if (!first) return { ...second };
  const minX = Math.min(first.x, second.x);
  const minY = Math.min(first.y, second.y);
  const maxX = Math.max(first.x + first.width, second.x + second.width);
  const maxY = Math.max(first.y + first.height, second.y + second.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function projectionFor(snapshot: CanvasOverviewSnapshot): MinimapProjection {
  const bounds = unionBounds(snapshot.contentBounds, snapshot.viewportBounds);
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const scale = Math.min(
    (VIEWBOX_WIDTH - MAP_PADDING * 2) / width,
    (VIEWBOX_HEIGHT - MAP_PADDING * 2) / height,
  );
  return {
    bounds,
    scale,
    offsetX: (VIEWBOX_WIDTH - width * scale) / 2,
    offsetY: (VIEWBOX_HEIGHT - height * scale) / 2,
  };
}

function projectPoint(point: { x: number; y: number }, projection: MinimapProjection) {
  return {
    x: projection.offsetX + (point.x - projection.bounds.x) * projection.scale,
    y: projection.offsetY + (point.y - projection.bounds.y) * projection.scale,
  };
}

function projectBounds(bounds: CanvasVisualBounds, projection: MinimapProjection) {
  const origin = projectPoint(bounds, projection);
  return {
    x: origin.x,
    y: origin.y,
    width: bounds.width * projection.scale,
    height: bounds.height * projection.scale,
  };
}

export function CanvasMinimap({ canvasRef, className }: CanvasMinimapProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const dragRef = React.useRef<MinimapDrag | null>(null);
  const [snapshot, setSnapshot] = React.useState<CanvasOverviewSnapshot | null>(null);
  const [dragProjection, setDragProjection] = React.useState<MinimapProjection | null>(null);
  const [viewBoxPerPixel, setViewBoxPerPixel] = React.useState({ x: 1, y: 1 });

  React.useEffect(() => canvasRef.current?.subscribeOverview(setSnapshot), [canvasRef]);

  React.useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const updateScale = () => {
      const bounds = svg.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const next = {
        x: VIEWBOX_WIDTH / bounds.width,
        y: VIEWBOX_HEIGHT / bounds.height,
      };
      setViewBoxPerPixel((current) =>
        Math.abs(current.x - next.x) < 0.001 && Math.abs(current.y - next.y) < 0.001
          ? current
          : next,
      );
    };
    updateScale();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
    const observer = new ResizeObserver(updateScale);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [snapshot !== null]);

  const calculatedProjection = React.useMemo(
    () => (snapshot ? projectionFor(snapshot) : null),
    [snapshot],
  );
  const projection = dragProjection ?? calculatedProjection;

  const stopDragging = React.useCallback((target?: SVGRectElement) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragProjection(null);
    if (drag && target?.hasPointerCapture(drag.pointerId)) {
      target.releasePointerCapture(drag.pointerId);
    }
  }, []);

  const startDragging = React.useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (!snapshot || !projection || event.button !== 0) return;
      const svgBounds = svgRef.current?.getBoundingClientRect();
      if (!svgBounds || svgBounds.width <= 0 || svgBounds.height <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      const viewport = snapshot.viewportBounds;
      dragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCenter: {
          x: viewport.x + viewport.width / 2,
          y: viewport.y + viewport.height / 2,
        },
        clientScaleX: VIEWBOX_WIDTH / svgBounds.width,
        clientScaleY: VIEWBOX_HEIGHT / svgBounds.height,
        projection,
      };
      setDragProjection(projection);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [projection, snapshot],
  );

  const dragViewport = React.useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = ((event.clientX - drag.startClientX) * drag.clientScaleX) / drag.projection.scale;
      const dy = ((event.clientY - drag.startClientY) * drag.clientScaleY) / drag.projection.scale;
      canvasRef.current?.setViewportCenter({
        x: drag.startCenter.x + dx,
        y: drag.startCenter.y + dy,
      });
    },
    [canvasRef],
  );

  const viewport =
    snapshot && projection ? projectBounds(snapshot.viewportBounds, projection) : null;

  return (
    <div className={["canvas-minimap", className].filter(Boolean).join(" ")}>
      <div className="canvas-minimap-map">
        {snapshot && projection && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            role="img"
            aria-label="Canvas minimap"
          >
            {snapshot.connectors.map((connector) => (
              <polyline
                key={connector.id}
                className="canvas-minimap-connector"
                points={connector.points
                  .map((point) => projectPoint(point, projection))
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
              />
            ))}
            {snapshot.cards.map((card) => {
              const origin = projectPoint(card, projection);
              const projectedWidth = card.width * projection.scale;
              const projectedHeight = card.height * projection.scale;
              const centerX = origin.x + projectedWidth / 2;
              const centerY = origin.y + projectedHeight / 2;
              const width = Math.max(projectedWidth, CARD_MIN_SIZE_PX * viewBoxPerPixel.x);
              const height = Math.max(projectedHeight, CARD_MIN_SIZE_PX * viewBoxPerPixel.y);
              return (
                <rect
                  key={card.id}
                  className="canvas-minimap-card"
                  x={centerX - width / 2}
                  y={centerY - height / 2}
                  width={width}
                  height={height}
                  rx={CARD_RADIUS_PX * viewBoxPerPixel.x}
                  ry={CARD_RADIUS_PX * viewBoxPerPixel.y}
                  transform={`rotate(${(card.rotation * 180) / Math.PI} ${centerX} ${centerY})`}
                />
              );
            })}
            {viewport && (
              <rect
                className="canvas-minimap-viewport"
                x={viewport.x}
                y={viewport.y}
                width={Math.max(1, viewport.width)}
                height={Math.max(1, viewport.height)}
                rx={2}
                onPointerDown={startDragging}
                onPointerMove={dragViewport}
                onPointerUp={(event) => stopDragging(event.currentTarget)}
                onPointerCancel={(event) => stopDragging(event.currentTarget)}
                onLostPointerCapture={(event) => stopDragging(event.currentTarget)}
              />
            )}
          </svg>
        )}
      </div>
      <div className="canvas-minimap-actions" role="toolbar" aria-label="Minimap actions">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="canvas-minimap-fit"
              aria-label="Fit all canvas elements"
              disabled={!snapshot?.contentBounds}
              onClick={() => canvasRef.current?.fitAllVisible()}
            >
              <Scan />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit all</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
