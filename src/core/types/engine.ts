
export type EndlessCanvasRuntimeOptions = {
  engine: CanvasEngine;
  document: CanvasRuntimeDocument;
  algorithms: CanvasRuntimeDependencies;
  ui: CanvasUiController;

  preferences: {
    current: () => CanvasPreferences;

    activateBoard: (
      boardId: string,
    ) => CanvasPreferences;

    change: (
      boardId: string,
      preferences: CanvasPreferences,
    ) => void;

    subscribe: (
      listener: (
        preferences: CanvasPreferences,
      ) => void,
    ) => () => void;
  };

  onError?: (
    message: string,
  ) => void;
};


