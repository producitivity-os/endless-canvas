import assert from "node:assert/strict";
import test from "node:test";
import { ImageObject } from "../src/core/model/image/image.ts";
import { TextObject } from "../src/core/model/text/text.ts";
import { TemplateCard } from "../src/core/model/card/card.ts";
import {
  materializeTemplateCard,
  templateValue,
  type CardTemplateDefinition,
} from "../src/core/model/card/template.ts";
import { canvasObjectFactory } from "../src/core/model/object-factory.ts";

function definition(): CardTemplateDefinition {
  return {
    id: "template.book",
    name: "Book",
    width: 360,
    height: 200,
    builtIn: false,
    revision: 3,
    createdAt: 1,
    updatedAt: 2,
    usageCount: 1,
    fields: [
      { id: "cover", label: "Cover", type: "image", required: false, defaultValue: { src: "default.jpg" } },
      { id: "name", label: "Name", type: "text", required: true, defaultValue: "Untitled" },
    ],
    elements: [
      new ImageObject({ id: "cover-element", type: "image", x: 12, y: 12, width: 100, height: 176, src: "", name: "Cover" }),
      new TextObject({ id: "name-element", type: "text", x: 128, y: 20, width: 210, height: 40, text: "Untitled" }),
    ],
    bindings: [
      { elementId: "cover-element", fieldId: "cover", property: "image" },
      { elementId: "name-element", fieldId: "name", property: "text" },
    ],
  };
}

test("template cards serialize and hydrate with stable template values", () => {
  const card = new TemplateCard({
    id: "book-one",
    type: "card",
    kind: "template",
    x: 10,
    y: 20,
    width: 360,
    height: 200,
    elements: [],
    templateId: "template.book",
    templateValues: { name: "Dune", cover: { src: "dune.jpg", name: "Dune cover" } },
  });
  const hydrated = canvasObjectFactory.hydrate(JSON.parse(JSON.stringify(card))) as TemplateCard;
  assert.ok(hydrated instanceof TemplateCard);
  assert.equal(hydrated.templateId, "template.book");
  assert.deepEqual(hydrated.templateValues, card.templateValues);
  assert.equal(hydrated.capabilities.resizable, false);
});

test("materializing a linked card applies values without modifying its template", () => {
  const template = definition();
  const original = JSON.stringify(template);
  const card = new TemplateCard({
    id: "book-two",
    type: "card",
    kind: "template",
    layerId: "library",
    x: 40,
    y: 50,
    width: 1,
    height: 1,
    elements: [],
    templateId: template.id,
    templateValues: { name: "The Dispossessed", cover: { src: "cover.jpg" } },
  });
  const resolved = materializeTemplateCard(card, template);
  assert.equal(resolved.width, template.width);
  assert.equal(resolved.height, template.height);
  assert.equal(resolved.layerId, "library");
  assert.equal((resolved.elements[0] as ImageObject).src, "cover.jpg");
  assert.equal((resolved.elements[1] as TextObject).text, "The Dispossessed");
  assert.deepEqual(resolved.elements.map((element) => element.id), [
    "book-two::cover-element",
    "book-two::name-element",
  ]);
  assert.equal(JSON.stringify(template), original);
});

test("template values fall back to field defaults only when absent", () => {
  const template = definition();
  assert.equal(templateValue(template, {}, "name"), "Untitled");
  assert.equal(templateValue(template, { name: "" }, "name"), "");
  assert.equal(templateValue(template, {}, "missing"), undefined);
});
