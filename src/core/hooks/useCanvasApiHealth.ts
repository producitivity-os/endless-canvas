import { useEffect } from "react";
import { canvasApiIsHealthy } from "@/api/canvas";
import { canvasPersistenceStore } from "@/features/canvas/store/canvasPersistenceStore";

export function useCanvasApiHealth(pollInterval = 5000) {
  useEffect(() => {
    const controller = new AbortController();
    const sync = async () => {
      const connected = await canvasApiIsHealthy(controller.signal);
      if (!controller.signal.aborted) canvasPersistenceStore.setApiConnected(connected);
    };
    void sync();
    const timer = window.setInterval(() => void sync(), pollInterval);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [pollInterval]);
}
