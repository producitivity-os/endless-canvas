import type { EndlessCanvasRuntimeOptions } from '@/core/types/runtime';
import './App.css'
import { EndlessCanvas } from "@productivity-os/canvas/react";
import { useMemo } from 'react';
import { CanvasEngine } from '@/core';

function App() {
  const options =
    useMemo(factory, deps)<
      EndlessCanvasRuntimeOptions
    >(
      () => ({
        engine:
          new CanvasEngine(),

        document:
          new CanvasRuntimeDocument(),

        algorithms:
          canvasAlgorithms,

        ui:
          canvasUi,

        persistence:
          canvasPersistenceAdapter,

        assets:
          canvasAssetAdapter,

        preferences:
          canvasPreferences,

        onError(message) {
          console.error(
            message,
          );
        },
      }),
      [],
    );

  return (
    <>
      <EndlessCanvas
        style={{
          width: "100vw",
          height: "100vh",
        }}
        options={options} />
    </>
  )
}

export default App
