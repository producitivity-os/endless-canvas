import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("../src/core/engine/engine.ts", import.meta.url), "utf8");

test("dot grids use a muted skewed isometric lattice", () => {
  assert.match(engine, /rowStep = step \* Math\.sqrt\(3\) \/ 2/);
  assert.match(engine, /skewedOrigin = viewport\.x \+ row \* step \/ 2/);
  assert.match(engine, /grid\.circle\(x, y, 1\.5\)/);
  assert.match(engine, /Math\.max\(opacity \* 0\.72, 0\.52\)/);
});
