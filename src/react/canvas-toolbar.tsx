import * as React from "react";
import {
  ArrowRight,
  ChevronDown,
  Circle,
  Diamond,
  FileText,
  FileVideo2,
  Hand,
  Image,
  LineSquiggle,
  Minus,
  MousePointer2,
  Pentagon,
  Shapes,
  Square,
  StickyNote,
  Type,
} from "lucide-react";
import { Button } from "@productivity-os/shared-ui/components/ui/button";
import { Kbd } from "@productivity-os/shared-ui/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@productivity-os/shared-ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@productivity-os/shared-ui/components/ui/tooltip";

import type { CanvasTool } from "../core/index.ts";
import "./canvas-toolbar.css";

export const CANVAS_TOOL_GROUPS = {
  select: { shortcut: "v", tools: ["select"] },
  hand: { shortcut: "h", tools: ["hand"] },
  text: { shortcut: "t", tools: ["text", "markdown"] },
  card: { shortcut: "c", tools: ["card", "markdown-card"] },
  shapes: {
    shortcut: "s",
    tools: ["rect", "ellipse", "diamond", "pentagon", "parallelogram"],
  },
  connector: { shortcut: "a", tools: ["arrow", "line"] },
  freehand: { shortcut: "p", tools: ["pencil"] },
  image: { shortcut: "i", tools: ["image", "video"] },
} as const satisfies Record<string, { shortcut: string; tools: readonly CanvasTool[] }>;

export type CanvasToolGroupId = keyof typeof CANVAS_TOOL_GROUPS;
export type CanvasToolGroup = {
  shortcut: string;
  tools: readonly CanvasTool[];
};

type CanvasToolbarCustomItemBase = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  selected?: boolean;
};

export type CanvasToolbarCustomActionItem = CanvasToolbarCustomItemBase & {
  onSelect(): void;
};

export type CanvasToolbarCustomSubmenuItem = CanvasToolbarCustomItemBase & {
  items: readonly CanvasToolbarCustomItem[];
};

export type CanvasToolbarCustomItem =
  CanvasToolbarCustomActionItem | CanvasToolbarCustomSubmenuItem;

export type CanvasToolbarCustomMenu = {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  active?: boolean;
  items: readonly CanvasToolbarCustomItem[];
  onPrimarySelect?: () => void;
};

export function nextCustomMenuItem(
  items: readonly CanvasToolbarCustomItem[],
  activeId?: string | null,
  rememberedId?: string | null,
  direction: 1 | -1 = 1,
): CanvasToolbarCustomActionItem | null {
  const actions = items.flatMap((item): CanvasToolbarCustomActionItem[] =>
    "items" in item ? flattenCustomMenuItems(item.items) : [item],
  );
  if (actions.length === 0) return null;
  const activeIndex = activeId ? actions.findIndex((item) => item.id === activeId) : -1;
  if (activeIndex >= 0) return actions[(activeIndex + direction + actions.length) % actions.length];
  return (
    actions.find((item) => item.id === rememberedId) ??
    actions.find((item) => item.selected) ??
    actions[0]
  );
}

function flattenCustomMenuItems(
  items: readonly CanvasToolbarCustomItem[],
): CanvasToolbarCustomActionItem[] {
  return items.flatMap((item) => ("items" in item ? flattenCustomMenuItems(item.items) : [item]));
}

function customMenuItemsWithoutSelection(
  items: readonly CanvasToolbarCustomItem[],
): readonly CanvasToolbarCustomItem[] {
  const selectedIndex = items.findIndex((item) => !("items" in item) && item.selected);
  if (selectedIndex >= 0) {
    return [...items.slice(selectedIndex + 1), ...items.slice(0, selectedIndex)];
  }

  return items.flatMap((item): CanvasToolbarCustomItem[] => {
    if (!("items" in item)) return [item];
    const visibleItems = customMenuItemsWithoutSelection(item.items);
    return visibleItems.length > 0 ? [{ ...item, items: visibleItems }] : [];
  });
}

function renderCustomMenuItems(items: readonly CanvasToolbarCustomItem[]): React.ReactNode {
  return items.map((item) =>
    "items" in item ? (
      <DropdownMenuSub key={item.id}>
        <DropdownMenuSubTrigger
          className="canvas-tool-menu-item"
          aria-label={item.label}
          title={item.label}
        >
          {item.icon ?? <StickyNote />}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="canvas-tool-menu">
          {renderCustomMenuItems(item.items)}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem
        key={item.id}
        className="canvas-tool-menu-item"
        aria-label={item.label}
        title={item.label}
        onClick={item.onSelect}
      >
        {item.icon ?? <StickyNote />}
      </DropdownMenuItem>
    ),
  );
}

const toolLabels: Record<CanvasTool, string> = {
  mouse: "Select",
  select: "Select",
  hand: "Hand",
  text: "Text",
  markdown: "Markdown",
  card: "Card",
  "markdown-card": "Markdown card",
  image: "Image",
  video: "Video",
  arrow: "Arrow",
  line: "Line",
  pencil: "Freehand path",
  rect: "Rectangle",
  ellipse: "Ellipse",
  diamond: "Diamond",
  pentagon: "Pentagon",
  parallelogram: "Parallelogram",
  add: "Add",
};

const toolIcons: Partial<Record<CanvasTool, React.ReactNode>> = {
  select: <MousePointer2 />,
  hand: <Hand />,
  text: <Type />,
  markdown: <FileText />,
  card: <StickyNote />,
  "markdown-card": <FileText />,
  image: <Image />,
  video: <FileVideo2 />,
  arrow: <ArrowRight />,
  line: <Minus />,
  pencil: <LineSquiggle />,
  rect: <Square />,
  ellipse: <Circle />,
  diamond: <Diamond />,
  pentagon: <Pentagon />,
  parallelogram: <Shapes />,
};

const groupOrder: CanvasToolGroupId[] = [
  "select",
  "hand",
  "text",
  "card",
  "shapes",
  "connector",
  "freehand",
  "image",
];

export function groupForTool(tool: CanvasTool): CanvasToolGroupId | null {
  return (
    groupOrder.find((group) => CANVAS_TOOL_GROUPS[group].tools.includes(tool as never)) ?? null
  );
}

export function groupForShortcut(
  key: string,
  enabledTools?: readonly CanvasTool[],
): CanvasToolGroupId | null {
  return (
    groupOrder.find(
      (group) =>
        CANVAS_TOOL_GROUPS[group].shortcut === key.toLowerCase() &&
        (!enabledTools ||
          CANVAS_TOOL_GROUPS[group].tools.some((tool) => enabledTools.includes(tool))),
    ) ?? null
  );
}

export function nextToolForGroup(
  group: CanvasToolGroupId,
  currentTool: CanvasTool,
  rememberedTool?: CanvasTool,
  enabledTools?: readonly CanvasTool[],
  direction: 1 | -1 = 1,
): CanvasTool {
  const tools = CANVAS_TOOL_GROUPS[group].tools.filter(
    (tool) => !enabledTools || enabledTools.includes(tool),
  );
  if (tools.length === 0) return "select";
  const currentIndex = tools.indexOf(currentTool as never);
  if (currentIndex >= 0) return tools[(currentIndex + direction + tools.length) % tools.length];
  return rememberedTool && tools.includes(rememberedTool as never) ? rememberedTool : tools[0];
}

type CanvasToolbarMenuToolProps = {
  group: CanvasToolGroupId;
  tool: CanvasTool;
  icon: React.ReactNode;
  label: string;
  onToolChange(tool: CanvasTool): void;
  enabledTools?: readonly CanvasTool[];
  iconOverrides?: Partial<Record<CanvasTool, React.ReactNode>>;
  preferredTool?: CanvasTool;
};

export function CanvasToolbarMenuTool({
  group,
  tool,
  icon,
  label,
  onToolChange,
  enabledTools,
  iconOverrides,
  preferredTool,
}: CanvasToolbarMenuToolProps) {
  const definition = CANVAS_TOOL_GROUPS[group];
  const availableTools = definition.tools.filter(
    (candidate) => !enabledTools || enabledTools.includes(candidate),
  );
  if (availableTools.length === 0) return null;
  const active = availableTools.includes(tool as never);
  const selectedTool = active
    ? tool
    : preferredTool && availableTools.includes(preferredTool as never)
      ? preferredTool
      : availableTools[0];
  const selectedIndex = availableTools.indexOf(selectedTool as never);
  const menuTools = [
    ...availableTools.slice(selectedIndex + 1),
    ...availableTools.slice(0, selectedIndex),
  ];

  return (
    <div className="canvas-toolbar-split" data-active={active || undefined}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="canvas-toolbar-main"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onToolChange(selectedTool)}
          >
            {active
              ? (iconOverrides?.[selectedTool] ?? toolIcons[selectedTool])
              : (iconOverrides?.[selectedTool] ?? icon)}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {toolLabels[selectedTool]} <Kbd>{definition.shortcut.toUpperCase()}</Kbd>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="canvas-toolbar-chevron"
              aria-label={`Choose ${label.toLowerCase()}`}
            />
          }
        >
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          alignOffset={-34}
          side="bottom"
          sideOffset={8}
          className="canvas-tool-menu"
        >
          {menuTools.map((candidate) => (
            <DropdownMenuItem
              key={candidate}
              className="canvas-tool-menu-item"
              aria-label={toolLabels[candidate]}
              title={toolLabels[candidate]}
              onClick={() => onToolChange(candidate)}
            >
              {iconOverrides?.[candidate] ?? toolIcons[candidate]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CanvasToolbarCustomMenuTool({
  label,
  icon,
  shortcut,
  active = false,
  items,
  onPrimarySelect,
}: CanvasToolbarCustomMenu) {
  const actions = flattenCustomMenuItems(items);
  const selectedItem = actions.find((item) => item.selected) ?? actions[0];
  const menuItems = customMenuItemsWithoutSelection(items);
  return (
    <div className="canvas-toolbar-split" data-active={active || undefined}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="canvas-toolbar-main"
            aria-label={label}
            aria-pressed={active}
            onClick={onPrimarySelect ?? selectedItem?.onSelect}
          >
            {selectedItem?.icon ?? icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {selectedItem?.label ?? label}
          {shortcut && (
            <>
              {" "}
              <Kbd>{shortcut.toUpperCase()}</Kbd>
            </>
          )}
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="canvas-toolbar-chevron"
              aria-label={`Choose ${label.toLowerCase()}`}
            />
          }
        >
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          alignOffset={-34}
          side="bottom"
          sideOffset={8}
          className="canvas-tool-menu"
        >
          {renderCustomMenuItems(menuItems)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SingleTool({
  group,
  tool,
  currentTool,
  onToolChange,
  enabledTools,
  iconOverrides,
}: {
  group: CanvasToolGroupId;
  tool: CanvasTool;
  currentTool: CanvasTool;
  onToolChange(tool: CanvasTool): void;
  enabledTools?: readonly CanvasTool[];
  iconOverrides?: Partial<Record<CanvasTool, React.ReactNode>>;
}) {
  if (enabledTools && !enabledTools.includes(tool)) return null;
  const shortcut = CANVAS_TOOL_GROUPS[group].shortcut.toUpperCase();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={toolLabels[tool]}
          aria-pressed={currentTool === tool}
          data-active={currentTool === tool || undefined}
          onClick={() => onToolChange(tool)}
        >
          {iconOverrides?.[tool] ?? toolIcons[tool]}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {toolLabels[tool]} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

export function CanvasToolbar({
  tool,
  onToolChange,
  enabledTools,
  addTool,
  cardTool,
  cardMenu,
  customTools,
  iconOverrides,
  preferredTools,
}: {
  tool: CanvasTool;
  onToolChange(tool: CanvasTool): void;
  enabledTools?: readonly CanvasTool[];
  addTool?: React.ReactNode;
  cardTool?: React.ReactNode;
  cardMenu?: CanvasToolbarCustomMenu;
  customTools?: React.ReactNode;
  iconOverrides?: Partial<Record<CanvasTool, React.ReactNode>>;
  preferredTools?: Partial<Record<CanvasToolGroupId, CanvasTool>>;
}) {
  return (
    <div className="canvas-floating-toolbar" role="toolbar" aria-label="Canvas tools">
      <SingleTool
        group="select"
        tool="select"
        currentTool={tool}
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
      />
      <SingleTool
        group="hand"
        tool="hand"
        currentTool={tool}
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
      />
      {enabledTools?.includes("add") && addTool}
      <CanvasToolbarMenuTool
        group="text"
        tool={tool}
        icon={<Type />}
        label="Text"
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
        preferredTool={preferredTools?.text}
      />
      {cardMenu ? (
        <CanvasToolbarCustomMenuTool {...cardMenu} />
      ) : (
        (cardTool ?? (
          <CanvasToolbarMenuTool
            group="card"
            tool={tool}
            icon={<StickyNote />}
            label="Cards"
            onToolChange={onToolChange}
            enabledTools={enabledTools}
            iconOverrides={iconOverrides}
            preferredTool={preferredTools?.card}
          />
        ))
      )}
      {customTools}
      <CanvasToolbarMenuTool
        group="shapes"
        tool={tool}
        icon={<Square />}
        label="Shapes"
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
        preferredTool={preferredTools?.shapes}
      />
      <CanvasToolbarMenuTool
        group="connector"
        tool={tool}
        icon={<ArrowRight />}
        label="Connectors"
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
        preferredTool={preferredTools?.connector}
      />
      <SingleTool
        group="freehand"
        tool="pencil"
        currentTool={tool}
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
      />
      <CanvasToolbarMenuTool
        group="image"
        tool={tool}
        icon={<Image />}
        label="Media"
        onToolChange={onToolChange}
        enabledTools={enabledTools}
        iconOverrides={iconOverrides}
        preferredTool={preferredTools?.image}
      />
    </div>
  );
}
