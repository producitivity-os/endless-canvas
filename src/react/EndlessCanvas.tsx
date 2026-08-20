import { initializeCanvasRuntime } from "@/core/runtime/initialise";
import type { EndlessCanvasRuntimeOptions } from "@/core/types/runtime";
import {
  useEffect,
  useRef,
} from "react";

// import {
//   initializeCanvasRuntime,
// } from "@/core/runtime";

// import type {
//   EndlessCanvasRuntimeOptions,
// } from "@/core/types";

export interface EndlessCanvasProps {
  options: EndlessCanvasRuntimeOptions;

  className?: string;

  style?: React.CSSProperties;
}

export function EndlessCanvas({
  options,
  className,
  style,
}: EndlessCanvasProps) {
  const hostRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host =
      hostRef.current;

    if (!host) {
      return;
    }

    let destroyed = false;

    let cleanup:
      | (() => void)
      | undefined;

    void initializeCanvasRuntime(
      host,
      options,
    ).then((runtimeCleanup) => {
      if (destroyed) {
        runtimeCleanup();
        return;
      }

      cleanup = runtimeCleanup;
    });

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [options]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
