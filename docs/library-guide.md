# Canvas library guide

This guide describes the public contracts of `@productivity-os/canvas`. It is written for application developers and for agents changing or integrating the library.

## Installation

Install the library with its React peer dependencies:

```bash
npm install @productivity-os/canvas react react-dom
```

PixiJS is a runtime dependency of the package. The host must run in a browser with WebGL support. React consumers normally import from the package root or `/react`; non-React consumers can import from `/core`.

## Minimal React setup

`EndlessCanvas` is controlled by a `tool` value and initializes its internal working state from `initialState`. Changes are reported through `onChange`.

```tsx
import { useState } from "react";
import { EndlessCanvas, type CanvasTool, type EndlessCanvasState } from "@productivity-os/canvas";

const initialState: EndlessCanvasState = { objects: [] };

export function Board() {
  const [tool, setTool] = useState<CanvasTool>("select");

  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <button onClick={() => setTool("rect")}>Rectangle</button>
      <button onClick={() => setTool("card")}>Card</button>
      <EndlessCanvas
        tool={tool}
        initialState={initialState}
        onChange={(next) => localStorage.setItem("board", JSON.stringify(next))}
        options={{ maxPaneDepth: 3 }}
        style={{ width: "100%", height: "100%" }}
      />
    </main>
  );
}
```

Contract: `initialState` is an initialization input, not a continuously controlled value. Changing its `objects` array recreates the canvas instance. Persist copies in `onChange`; do not mutate the reported state from outside while an interaction is active.

## State contract

The persisted state has one field:

```ts
interface EndlessCanvasState {
  objects: CanvasObject[];
}
```

Every object has these base fields:

```ts
interface CanvasObjectData {
  id: string;
  type:
    | "card"
    | "rect"
    | "ellipse"
    | "diamond"
    | "pentagon"
    | "parallelogram"
    | "image"
    | "path"
    | "arrow"
    | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
  opacity: number; // 0 through 1
}
```

Coordinates and dimensions are world units. Object coordinates inside a card are local to that card. IDs must be unique throughout the full nested document, not only within one pane. Keeping IDs globally unique makes selection, retained rendering, image loading, Markdown caching, and arrow binding deterministic.

### Shape objects

All five shape types add `fill`, `stroke`, optional `strokeWidth`, and `fillStyle`. Shape-specific parameters are:

```ts
type ShapeFields = {
  rect: { cornerRadius?: number };
  ellipse: { arcSweep?: number }; // normalized 0.01 through 1
  diamond: { waistRatio?: number };
  pentagon: { shoulderRatio?: number; apexRatio?: number };
  parallelogram: { slantRatio?: number };
};
```

Use the exported `RectangleObject`, `EllipseObject`, `DiamondObject`, `PentagonObject`, and `ParallelogramObject` constructors when building state programmatically.

### Text objects

Text objects include `text`, `format`, typography, alignment, line height, letter spacing, padding, and color. `format` is `"plain"` or `"markdown"`. Markdown supports rich text and inline math; links render inertly inside the canvas.

```ts
import { TextObject } from "@productivity-os/canvas/core";

const title = new TextObject({
  id: crypto.randomUUID(),
  type: "text",
  x: 20,
  y: 20,
  width: 240,
  height: 48,
  text: "# Project map",
  format: "markdown",
  fontSize: 24,
  color: 0x172033,
});
```

### Paths

A path stores `points: CanvasPoint[]`, `color`, and the common shape stroke fields. Points are world coordinates in the active pane. The renderer draws a rounded polyline through them.

### Images

Images add `src`, optional `previewSrc`, file metadata, normalized crop data, aspect-ratio locking, and corner radius. Applications may provide an asset adapter:

```ts
const options = {
  assets: {
    async uploadImage(dataUrl: string, name: string) {
      const response = await fetch("/api/assets", {
        method: "POST",
        body: JSON.stringify({ dataUrl, name }),
      });
      return (await response.json()) as { url: string; name: string };
    },
  },
};
```

`previewSrc` is useful while an upload is pending. Applications should persist the final `src` returned by the adapter.

### Arrows

An arrow has `start` and `end` endpoints, a path, render mode, heads, stroke, and stroke width.

```ts
type ArrowEndpoint = {
  point: { x: number; y: number };
  binding?: {
    objectId: string;
    anchor: { x: number; y: number }; // normalized in the bound object
    hint?: "top" | "right" | "bottom" | "left";
  };
};

type ArrowPath =
  | { type: "straight" }
  | {
      type: "curved";
      controls: [{ along: number; offset: number }, { along: number; offset: number }];
    }
  | {
      type: "angular";
      orthogonal: boolean;
      waypoints: Array<{ along: number; offset: number }>;
    };
```

`renderMode` is `"between"`, `"over"`, or `"under"`. Arrow heads are `"none"`, `"triangle"`, `"triangle-outline"`, or `"chicken"`. Head length and spread are fixed world dimensions, so zooming changes their visible screen size along with the drawing. Shaft trimming uses the same world-space head length.

Curved paths preserve both stored Bézier controls. Editing intentionally exposes only the two endpoints and the on-curve center handle; off-curve controls and guide hit targets are not part of the interaction contract.

### Cards

A card is a regular object plus `elements: CanvasObject[]`, optional background color, locking, and text-card metadata. Cards can contain other cards to any serialized depth.

```ts
import { TextCard, RectangleObject } from "@productivity-os/canvas/core";

const nestedCard = new TextCard({
  id: crypto.randomUUID(),
  type: "card",
  x: 100,
  y: 80,
  width: 220,
  height: 140,
  elements: [
    new RectangleObject({
      id: crypto.randomUUID(),
      type: "rect",
      x: 24,
      y: 24,
      width: 120,
      height: 72,
      fill: 0xeef2ff,
      stroke: 0x4f46e5,
      strokeWidth: 2,
      fillStyle: "solid",
    }),
  ],
});
```

Invariant: preview textures and pane navigation data never become fields on a card and are never serialized.

## Tools and interactions

`CanvasTool` accepts `mouse`, `select`, `hand`, `text`, `markdown`, `card`, `image`, `arrow`, `line`, `pencil`, `rect`, `ellipse`, `diamond`, `pentagon`, `parallelogram`, and `add`.

`mouse` and `select` select, move, resize, rotate, edit parameters, and open objects. `hand` pans. Creation tools create their named object. `line` is an arrow with no default end head. `add` is reserved for a host-level add workflow.

The built-in keyboard behavior is:

- Backspace or Delete removes the selection.
- Command/Ctrl+A selects every object in the active pane.
- Enter commits an active image crop.
- Escape cancels the current interaction first. If no interaction is active, it clears the selection. If the pane is idle and has no selection, it commits that card and goes back one pane.

Rectangle, ellipse, diamond, pentagon, and parallelogram resize handles are white circles with blue borders. Their outline positions, hit areas, rotation handles, and parameter handles remain shape-specific. Image and text resize handles remain square.

## Properties

Use `propertiesSlot` to render a host-owned inspector. The slot receives a context and a patch function.

```tsx
import type { CanvasPropertiesSlotProps } from "@productivity-os/canvas/react";

function Inspector({ context, onPatch }: CanvasPropertiesSlotProps) {
  if (context.mode === "none") return null;
  return (
    <aside>
      {context.fields.map((field) => (
        <button key={field.name} onClick={() => onPatch({ opacity: 0.5 })}>
          {field.label}: {String(field.value)}
        </button>
      ))}
    </aside>
  );
}
```

The context mode is `none`, `defaults`, or `selection`. A field value may be `CANVAS_MIXED_VALUE` for a multi-selection. A patch changes tool defaults when nothing is selected and changes all compatible selected objects otherwise.

## Card panes

Double-click a card with the select or mouse tool to open it. Its committed elements are hydrated into a private working copy and become the active infinite canvas. This is an atomic editing boundary: mutations in a pane do not change the parent card until that pane exits.

Panes can nest. Each entry saves the parent viewport, selection, and primary selection. A new pane starts at scale `1`, centered on its visual contents; an empty pane centers the world origin. Exiting restores the exact parent viewport and valid saved selection.

`maxPaneDepth` counts the root as level `0`. It defaults to `3`, accepts non-negative integers or `Infinity`, and falls back to `3` for all other values. `0` disables card entry. Entry at or beyond the limit is inert.

Observe navigation from React with `onPaneChange`:

```tsx
import type { CanvasPaneContext } from "@productivity-os/canvas";

function onPaneChange(context: CanvasPaneContext) {
  console.log(context.stackLevel, context.cardPath, context.canGoBack);
}

<EndlessCanvas
  tool="select"
  options={{
    maxPaneDepth: 5,
    onPaneChange: (context) => console.log("fallback", context),
  }}
  onPaneChange={onPaneChange}
/>;
```

The direct prop takes precedence over `options.onPaneChange`. The callback runs once at controller initialization and then once per successful entry or exit. Panning, zooming, selection, hover, blocked entry, and content changes do not emit pane changes.

The context contract is:

```ts
interface CanvasPaneContext {
  stackLevel: number;
  readonly cardPath: readonly string[];
  canGoBack: boolean;
  maxPaneDepth: number;
}
```

`cardPath` is ordered from the root card to the active card. Treat the context and path as immutable snapshots.

Dirty card commits first fit the card to its working contents, then invalidate and regenerate its preview. A nested commit marks its parent pane dirty. The root `onChange` fires only once, when the outermost dirty pane exits and the changes become part of root state. Exiting an unchanged pane does not fire `onChange`.

## Direct controller integration

Non-React applications can construct the engine and controller directly. The pane methods are available on `CanvasController`.

```ts
import {
  CanvasController,
  CanvasEngine,
  CanvasSelectionController,
  EndlessCanvasRuntimeState,
  type EndlessCanvasState,
} from "@productivity-os/canvas/core";

const host = document.querySelector<HTMLDivElement>("#canvas")!;
const state: EndlessCanvasState = { objects: [] };
const runtime = new EndlessCanvasRuntimeState();
const engine = new CanvasEngine();
const save = (serialized: string) => localStorage.setItem("board", serialized);
const updateBreadcrumb = (cardPath: readonly string[]) => console.log(cardPath.join(" / "));
await engine.initialize(host);

const controller = new CanvasController({
  engine,
  state,
  runtime,
  selection: new CanvasSelectionController(runtime.selection),
  maxPaneDepth: 3,
  onChange: () => save(JSON.stringify(state)),
  onPaneChange: (context) => updateBreadcrumb(context.cardPath),
});

const unsubscribe = controller.subscribePaneChange((context) => {
  console.log(context.stackLevel);
});

controller.enterCard("card-id");
controller.getPaneContext();
controller.commitAndExitPane();

unsubscribe();
controller.destroy();
engine.destroy();
```

`paneContext()` and `getPaneContext()` return the same snapshot. `enterCard()` and `enterCardPane()` are aliases. `commitAndExitPane()` and `exitPane()` are aliases. Each returns `false` when the operation is not available and makes no navigation change.

## Fitting cards explicitly

The standalone operation mutates a card and reports whether anything changed:

```ts
import { fitCardToContent, type CanvasCardObject } from "@productivity-os/canvas/core";

const persistCard = (card: CanvasCardObject) =>
  localStorage.setItem(`card:${card.id}`, JSON.stringify(card));

function normalizeCard(card: CanvasCardObject) {
  if (fitCardToContent(card)) {
    persistCard(card);
  }
}
```

The fitter computes visual bounds for rotated shapes and objects, path and shape strokes, sampled curved and angular arrows, arrowheads, and nested card frames. It translates local content into padded coordinates, resizes the outer card, and accounts for card rotation so content keeps the same apparent position in the parent pane. Empty cards use the library minimum dimensions.

When a live controller owns the card, prefer `controller.fitCardToContent(cardOrId)`. That method also invalidates the card preview, marks the current pane dirty or emits a root change, and renders the result.

## Persistence

Persist plain JSON derived from `EndlessCanvasState`:

```ts
function saveState(state: EndlessCanvasState): string {
  return JSON.stringify(state);
}

function loadState(serialized: string): EndlessCanvasState {
  return JSON.parse(serialized) as EndlessCanvasState;
}
```

The React component hydrates plain loaded objects recursively, including nested card elements. Direct consumers that load plain JSON can call `canvasObjectFactory.hydrate` for each root object before constructing lower-level services.

```ts
import { canvasObjectFactory } from "@productivity-os/canvas/core";

const raw = JSON.parse(localStorage.getItem("board") ?? '{"objects":[]}') as EndlessCanvasState;
const hydrated: EndlessCanvasState = {
  objects: raw.objects.map((object) => canvasObjectFactory.hydrate(object)),
};
```

Persist only model fields. Do not persist Pixi containers, render textures, selection, viewport stack frames, hover state, editor sessions, or pane contexts. Cached previews are reconstructed lazily after loading.

## Rendering and cache invariants

Every non-active card renders its committed contents through one transparent Pixi render texture. A parent preview requests nested previews before its own snapshot, so generation is bottom-up.

Preview generation is lazy. The first visible render after loading creates one snapshot per needed card. Pan, zoom, hover, and selection may rebuild lightweight view chrome but reuse the same preview texture. Only a card commit or explicit controller fitting invalidates a preview. Parent previews are regenerated when their pane commits.

Preview pixels are inert. Parent-pane hit testing sees only the card container; internal preview objects cannot be selected, hovered, bound, dragged, or edited until the card is opened.

Deleting a card disposes its texture after the committed document is rendered. Engine destruction disposes all remaining card textures. Pruning walks nested card contents, both for preview textures and retained Markdown resources.

## Extension points

The supported host extension points are:

- `propertiesSlot` for a React-owned properties interface.
- `assets.uploadImage` for application storage.
- `onCropRequest` for image-crop telemetry or host UI coordination.
- `onError` for async image or persistence failures.
- `onChange` for state persistence.
- `onPaneChange` for breadcrumbs and back controls.
- `defaultTextFormat` for text-tool defaults.
- `CanvasController` for non-React event integration.
- `ElementRenderer` and `ElementRendererRegistry` for advanced renderer work inside a maintained fork.

The serialized `CanvasObjectType` union is closed. Adding a new object type requires coordinated model hydration, rendering, hit testing, selection, property support, fitting bounds, preview rendering, serialization tests, and documentation.

## Lifecycle

For React, mounting initializes Pixi, interactions, text editing, image picking, and caches. Unmounting detaches interactions and destroys editors, controller listeners, textures, Markdown resources, and the Pixi application.

For direct integrations, initialize the engine before creating or rendering the controller. Detach any host event listeners, call `controller.destroy()`, then call `engine.destroy()`. Do not reuse a destroyed engine.

Application invariants:

1. Keep object IDs globally unique across nested cards.
2. Treat `onChange` state as the committed root document.
3. Treat pane working copies and pane contexts as runtime-only.
4. Use controller entry, exit, and fitting methods when an active controller owns the document.
5. Keep arrow bindings within the same active pane.
6. Persist final image URLs rather than temporary upload previews when possible.
7. Destroy direct integrations to release GPU textures and DOM resources.
