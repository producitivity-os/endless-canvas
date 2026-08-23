import type { CanvasTool } from "@endless-canvas/core";
import type { ReactNode } from "react";
import { ToolIcon, type ToolIconName } from "./ToolIcon";
import "./Toolbar.css";

export interface CanvasToolbarItem {
  tool: CanvasTool;
  label: string;
  icon?: ReactNode;
  iconName?: ToolIconName;
  group: "navigate" | "content" | "shapes" | "connectors";
}

export interface CanvasToolbarProps {
  value: CanvasTool;
  onChange(tool: CanvasTool): void;
  items?: CanvasToolbarItem[];
  className?: string;
}

const defaultItems: CanvasToolbarItem[] = [
  { tool: "select", label: "Select", iconName: "select", group: "navigate" },
  { tool: "hand", label: "Hand", iconName: "hand", group: "navigate" },
  { tool: "card", label: "Card", iconName: "card", group: "content" },
  { tool: "text", label: "Text", iconName: "text", group: "content" },
  { tool: "image", label: "Image", iconName: "image", group: "content" },
  { tool: "rect", label: "Rectangle", iconName: "rect", group: "shapes" },
  { tool: "ellipse", label: "Ellipse", iconName: "ellipse", group: "shapes" },
  { tool: "diamond", label: "Diamond", iconName: "diamond", group: "shapes" },
  { tool: "pentagon", label: "Pentagon", iconName: "pentagon", group: "shapes" },
  {
    tool: "parallelogram",
    label: "Parallelogram",
    iconName: "parallelogram",
    group: "shapes",
  },
  { tool: "arrow", label: "Arrow", iconName: "arrow", group: "connectors" },
  { tool: "line", label: "Line", iconName: "line", group: "connectors" },
  { tool: "pencil", label: "Pencil", iconName: "pencil", group: "connectors" },
];

export function CanvasToolbar({
  value,
  onChange,
  items = defaultItems,
  className,
}: CanvasToolbarProps) {
  return (
    <div
      className={["canvas-toolbar", className].filter(Boolean).join(" ")}
      role="toolbar"
      aria-label="Canvas tools"
    >
      {items.map((item, index) => {
        const active = value === item.tool;
        const startsGroup = index > 0 && items[index - 1]?.group !== item.group;

        return (
          <span className="canvas-toolbar__item" key={item.tool}>
            {startsGroup && <span className="canvas-toolbar__separator" aria-hidden="true" />}
            <button
              className="canvas-toolbar__button"
              type="button"
              aria-label={item.label}
              aria-pressed={active}
              data-tool={item.tool}
              data-tooltip={item.label}
              onClick={() => onChange(item.tool)}
            >
              {item.icon ?? (item.iconName ? <ToolIcon name={item.iconName} /> : null)}
            </button>
          </span>
        );
      })}
    </div>
  );
}
