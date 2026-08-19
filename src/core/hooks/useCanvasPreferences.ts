import { useCallback, useRef, useState, type SetStateAction } from "react";
import {
  defaultCanvasPreferences,
  loadCanvasPreferences,
  saveCanvasPreferences,
  type CanvasPreferences,
} from "@/features/canvas/preferences";

export function useCanvasPreferences(initialBoardId = "") {
  const activeBoardId = useRef(initialBoardId);
  const current = useRef(loadCanvasPreferences(initialBoardId));
  const [preferences, setPreferenceState] = useState<CanvasPreferences>(current.current);

  const publish = useCallback((boardId: string, next: CanvasPreferences, persist: boolean) => {
    activeBoardId.current = boardId;
    current.current = next;
    if (persist) saveCanvasPreferences(boardId, next);
    setPreferenceState(next);
    return next;
  }, []);

  const activateBoard = useCallback((boardId: string) => (
    publish(boardId, loadCanvasPreferences(boardId), false)
  ), [publish]);

  const updateBoardPreferences = useCallback((boardId: string, next: CanvasPreferences) => {
    saveCanvasPreferences(boardId, next);
    if (boardId === activeBoardId.current) publish(boardId, next, false);
  }, [publish]);

  const setPreferences = useCallback((next: SetStateAction<CanvasPreferences>) => {
    const value = typeof next === "function"
      ? (next as (current: CanvasPreferences) => CanvasPreferences)(current.current)
      : next;
    publish(activeBoardId.current, value, true);
  }, [publish]);

  const resetPreferences = useCallback(() => {
    publish(activeBoardId.current, defaultCanvasPreferences(), true);
  }, [publish]);

  return {
    preferences,
    activeBoardId: activeBoardId.current,
    activateBoard,
    updateBoardPreferences,
    setPreferences,
    resetPreferences,
  };
}
