export function isCanvasUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    Boolean(target.closest("[data-canvas-ui='true'], [data-canvas-interactive-overlay='true']"))
  );
}
