import * as React from "react";
import {
  ClipboardPaste,
  Copy,
  Crop,
  ExternalLink,
  FilePenLine,
  Play,
  Scaling,
  Scissors,
  Trash2,
} from "lucide-react";

import { platformShortcut } from "@productivity-os/shared-ui/components/application-context-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@productivity-os/shared-ui/components/ui/context-menu";

import type { CanvasContextTarget, CanvasPoint } from "../core";
import type { EndlessCanvasHandle } from "./EndlessCanvas";

type CanvasSurfaceContextMenuProps = {
  canvasRef: React.RefObject<EndlessCanvasHandle | null>;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  canvasSelector?: string;
  onOpenMedia?: (mediaId: string) => void | Promise<void>;
  onError?: (error: unknown) => void;
  additionalActions?: (target: CanvasContextTarget) => readonly CanvasSurfaceContextAction[];
};

export type CanvasSurfaceContextAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onSelect(): void | Promise<void>;
};

const EMPTY_TARGET: CanvasContextTarget = {
  kind: "empty",
  objectId: null,
  selectedIds: [],
  actions: ["paste"],
};

function CanvasSurfaceContextMenu({
  canvasRef,
  children,
  canvasSelector = ".canvas-endless-canvas",
  onOpenMedia,
  onError,
  additionalActions,
}: CanvasSurfaceContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<CanvasContextTarget>(EMPTY_TARGET);
  const pointRef = React.useRef<CanvasPoint>({ x: 0, y: 0 });
  const suppressOpenRef = React.useRef(false);
  const run = React.useCallback(
    (operation: () => unknown | Promise<unknown>) => {
      try {
        void Promise.resolve(operation()).catch((error) => onError?.(error));
      } catch (error) {
        onError?.(error);
      }
    },
    [onError],
  );
  const objectId = target.objectId;
  const actions = new Set(target.actions);
  const objectActions =
    actions.has("edit") ||
    actions.has("fit") ||
    actions.has("crop") ||
    actions.has("toggle-playback") ||
    actions.has("open-original");
  const clipboardActions = actions.has("cut") || actions.has("copy") || actions.has("paste");
  const customActions = additionalActions?.(target) ?? [];

  return (
    <ContextMenu
      open={open}
      onOpenChange={(next) => {
        if (next && suppressOpenRef.current) {
          suppressOpenRef.current = false;
          return;
        }
        setOpen(next);
      }}
    >
      <ContextMenuTrigger asChild>
        {React.cloneElement(children, {
          onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
            children.props.onContextMenu?.(event);
            if (event.defaultPrevented) return;
            if (
              event.target instanceof Element &&
              event.target.closest(
                "input:not([disabled]), textarea:not([disabled]), [contenteditable='true']",
              )
            ) {
              suppressOpenRef.current = true;
              setOpen(false);
              return;
            }
            const canvasHost = event.currentTarget.querySelector<HTMLElement>(canvasSelector);
            if (!canvasHost) return;
            const bounds = canvasHost.getBoundingClientRect();
            const point = {
              x: event.clientX - bounds.left,
              y: event.clientY - bounds.top,
            };
            pointRef.current = point;
            const next = canvasRef.current?.prepareContextMenu(point) ?? EMPTY_TARGET;
            setTarget(next);
            if (next.actions.length === 0) event.preventDefault();
          },
        })}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {objectId && actions.has("edit") && (
          <ContextMenuItem onSelect={() => canvasRef.current?.editObject(objectId)}>
            <FilePenLine /> Edit
          </ContextMenuItem>
        )}
        {objectId && actions.has("fit") && (
          <ContextMenuItem onSelect={() => canvasRef.current?.fitObjectToContent(objectId)}>
            <Scaling /> Fit to content
          </ContextMenuItem>
        )}
        {objectId && actions.has("crop") && (
          <ContextMenuItem onSelect={() => canvasRef.current?.cropImage(objectId)}>
            <Crop /> Crop
          </ContextMenuItem>
        )}
        {objectId && actions.has("toggle-playback") && (
          <ContextMenuItem onSelect={() => run(() => canvasRef.current?.toggleVideo(objectId))}>
            <Play /> Play or pause
          </ContextMenuItem>
        )}
        {objectId && actions.has("open-original") && target.mediaId && onOpenMedia && (
          <ContextMenuItem onSelect={() => run(() => onOpenMedia(target.mediaId!))}>
            <ExternalLink /> Open original
          </ContextMenuItem>
        )}
        {customActions.map((action) => (
          <ContextMenuItem
            key={action.id}
            variant={action.variant}
            onSelect={() => run(action.onSelect)}
          >
            {action.icon}
            {action.label}
          </ContextMenuItem>
        ))}
        {(objectActions || customActions.length > 0) && clipboardActions && (
          <ContextMenuSeparator />
        )}
        {actions.has("cut") && (
          <ContextMenuItem onSelect={() => run(() => canvasRef.current?.cutSelection())}>
            <Scissors /> Cut
            <ContextMenuShortcut>{platformShortcut("⌘X", "Ctrl+X")}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {actions.has("copy") && (
          <ContextMenuItem onSelect={() => run(() => canvasRef.current?.copySelection())}>
            <Copy /> Copy
            <ContextMenuShortcut>{platformShortcut("⌘C", "Ctrl+C")}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {actions.has("paste") && (
          <ContextMenuItem
            onSelect={() => run(() => canvasRef.current?.pasteClipboard(pointRef.current))}
          >
            <ClipboardPaste /> Paste
            <ContextMenuShortcut>{platformShortcut("⌘V", "Ctrl+V")}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {actions.has("delete") &&
          (clipboardActions || objectActions || customActions.length > 0) && (
            <ContextMenuSeparator />
          )}
        {actions.has("delete") && (
          <ContextMenuItem
            variant="destructive"
            onSelect={() => canvasRef.current?.deleteSelection()}
          >
            <Trash2 /> Delete
            <ContextMenuShortcut>{platformShortcut("⌫", "Delete")}</ContextMenuShortcut>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export { CanvasSurfaceContextMenu };
export type { CanvasSurfaceContextMenuProps };
