import type {
  CanvasAssetAdapter,
  EndlessCanvasOptions,
  UploadedCanvasImage,
} from "@endless-canvas/core";
import "./App.css";
import { EndlessCanvas } from "@endless-canvas/react";
import { useState } from "react";
import { CanvasToolbar, type CanvasTool } from "./components/Toolbar";

const onError = (error: unknown) => {
  console.warn("Failed to persist canvas.", error);
};

const onChange = () => {};

const assets: CanvasAssetAdapter = {
  uploadImage: function (dataUrl: string, name: string): Promise<UploadedCanvasImage> {
    throw new Error("Function not implemented.");
  },
};

function App() {
  const options: EndlessCanvasOptions = {};

  const [mode, setMode] = useState<CanvasTool>("select");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      <EndlessCanvas
        className="w-full h-full"
        mode={mode}
        onError={onError}
        onChange={onChange}
        options={options}
      />

      <CanvasToolbar value={mode} onChange={setMode} className="canvas-toolbar absolute top-0" />
    </div>
  );
}

export default App;
