import assert from "node:assert/strict";
import test from "node:test";
import { RevisionCard } from "../src/core/model/card/card.ts";
import { canvasObjectFactory } from "../src/core/model/object-factory.ts";

test("revision cards serialize and hydrate their study fields", () => {
  const card = new RevisionCard({
    id: "revision-one", type: "card", kind: "revision", revisionKind: "cloze", layerId: "questions",
    x: 10, y: 20, width: 320, height: 200, elements: [], front: "", back: "",
    cloze: "Water freezes at {{c1::0°C}}.",
  });
  const hydrated = canvasObjectFactory.hydrate(JSON.parse(JSON.stringify(card))) as RevisionCard;
  assert.ok(hydrated instanceof RevisionCard);
  assert.equal(hydrated.revisionKind, "cloze");
  assert.equal(hydrated.cloze, "Water freezes at {{c1::0°C}}.");
  assert.equal(hydrated.layerId, "questions");
});

test("legacy revision cards receive safe defaults", () => {
  const hydrated = canvasObjectFactory.hydrate({
    id: "revision-legacy", type: "card", kind: "revision", layerId: "main",
    x: 0, y: 0, width: 320, height: 200, elements: [],
  } as never) as RevisionCard;
  assert.equal(hydrated.revisionKind, "basic");
  assert.equal(hydrated.front, "Question");
  assert.equal(hydrated.back, "Answer");
});
