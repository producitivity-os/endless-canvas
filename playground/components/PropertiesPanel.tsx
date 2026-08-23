import {
  CANVAS_MIXED_VALUE,
  type CanvasPropertyField,
  type CanvasPropertyPatch,
} from "@endless-canvas/core";
import type { CanvasPropertiesSlotProps } from "@endless-canvas/react";
import "./PropertiesPanel.css";

const colorValue = (value: unknown): string =>
  typeof value === "number" ? `#${value.toString(16).padStart(6, "0")}` : "#000000";

const colorNumber = (value: string): number => Number.parseInt(value.slice(1), 16);

export function CanvasPropertiesPanel({ context, onPatch }: CanvasPropertiesSlotProps) {
  if (context.fields.length === 0) return null;

  const title =
    context.mode === "selection"
      ? context.selectionCount === 1
        ? "Properties"
        : `${context.selectionCount} selected`
      : `${context.tool === "markdown" ? "Text" : context.tool} defaults`;

  return (
    <aside
      className="canvas-properties"
      aria-label="Canvas properties"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="canvas-properties__title">{title}</div>
      <div className="canvas-properties__fields">
        {context.fields.map((field) => (
          <PropertyControl key={field.name} field={field} onPatch={onPatch} />
        ))}
      </div>
    </aside>
  );
}

interface PropertyControlProps {
  field: CanvasPropertyField;
  onPatch(patch: CanvasPropertyPatch): void;
}

function PropertyControl({ field, onPatch }: PropertyControlProps) {
  const mixed = field.value === CANVAS_MIXED_VALUE;
  const patch = (value: unknown) => onPatch({ [field.name]: value } as CanvasPropertyPatch);

  return (
    <label className="canvas-properties__field">
      <span>{field.label}</span>
      {field.control === "color" ? (
        <span className="canvas-properties__color-control">
          <input
            type="color"
            aria-label={field.label}
            value={colorValue(field.value)}
            onChange={(event) => patch(colorNumber(event.currentTarget.value))}
          />
          <span>{mixed ? "Mixed" : colorValue(field.value).toUpperCase()}</span>
        </span>
      ) : field.control === "number" ? (
        <input
          type="number"
          aria-label={field.label}
          value={mixed ? "" : String(field.value)}
          placeholder={mixed ? "Mixed" : undefined}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => {
            if (event.currentTarget.value !== "") patch(event.currentTarget.valueAsNumber);
          }}
        />
      ) : field.control === "select" ? (
        <select
          aria-label={field.label}
          value={mixed ? CANVAS_MIXED_VALUE : String(field.value)}
          onChange={(event) => patch(event.currentTarget.value)}
        >
          {mixed && <option value={CANVAS_MIXED_VALUE}>Mixed</option>}
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="canvas-properties__checkbox"
          type="checkbox"
          aria-label={field.label}
          checked={!mixed && field.value === true}
          onChange={(event) => patch(event.currentTarget.checked)}
        />
      )}
    </label>
  );
}
