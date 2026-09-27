import type { CanvasTool, EndlessCanvasOptions, EndlessCanvasState } from "@endless-canvas/core";
import "./App.css";
import { CanvasToolbar, EndlessCanvas } from "@endless-canvas/react";
import { useState } from "react";
import { CanvasPropertiesPanel } from "./components/PropertiesPanel";

const onError = (error: unknown) => {
  console.warn("Failed to persist canvas.", error);
};

const onChange = (state: EndlessCanvasState) => {
  console.log(state);
};

const options: EndlessCanvasOptions = {};

function App() {
  const [tool, setTool] = useState<CanvasTool>("select");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      <EndlessCanvas
        className="w-full h-full"
        tool={tool}
        onError={onError}
        onChange={onChange}
        options={options}
        propertiesSlot={(props) => <CanvasPropertiesPanel {...props} />}
      />

      <CanvasToolbar tool={tool} onToolChange={setTool} />
    </div>
  );
}

export default App;
