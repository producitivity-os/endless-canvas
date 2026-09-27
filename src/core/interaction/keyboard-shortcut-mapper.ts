export type KeyboardShortcutAction =
  | "delete-selection"
  | "select-all"
  | "copy-selection"
  | "cut-selection"
  | "paste"
  | "undo"
  | "redo"
  | "cancel"
  | "commit-interaction";

export interface KeyboardShortcutDefinition {
  action: KeyboardShortcutAction;
  keys: readonly string[];
  primaryModifier?: boolean;
}

export const defaultKeyboardShortcuts: readonly KeyboardShortcutDefinition[] = [
  { action: "delete-selection", keys: ["Backspace", "Delete"] },
  { action: "select-all", keys: ["a"], primaryModifier: true },
  { action: "copy-selection", keys: ["c"], primaryModifier: true },
  { action: "cut-selection", keys: ["x"], primaryModifier: true },
  { action: "paste", keys: ["v"], primaryModifier: true },
  { action: "undo", keys: ["z"], primaryModifier: true },
  { action: "redo", keys: ["u"], primaryModifier: true },
  { action: "cancel", keys: ["Escape"] },
  { action: "commit-interaction", keys: ["Enter"] },
];

export class KeyboardShortcutMapper {
  private readonly definitions: readonly KeyboardShortcutDefinition[];

  constructor(definitions: readonly KeyboardShortcutDefinition[] = defaultKeyboardShortcuts) {
    this.definitions = definitions;
  }

  actionFor(event: KeyboardEvent): KeyboardShortcutAction | null {
    if (this.isEditable(event.target)) {
      return null;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const definition = this.definitions.find((candidate) => {
      const modifierMatches = candidate.primaryModifier
        ? event.metaKey || event.ctrlKey
        : !event.metaKey && !event.ctrlKey;

      return modifierMatches && candidate.keys.includes(key);
    });

    return definition?.action ?? null;
  }

  private isEditable(target: EventTarget | null): boolean {
    if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
      return false;
    }

    return (
      target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      Boolean(target.closest("[contenteditable='true']"))
    );
  }
}
