import { Container, Graphics, Text } from "pixi.js";
import type { RevisionCard } from "../../model";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif";

function label(text: string, size: number, color: number, width: number): Text {
  const view = new Text({
    text,
    style: {
      fill: color,
      fontFamily: FONT,
      fontSize: size,
      fontWeight: size >= 18 ? "600" : "400",
      align: "center",
      wordWrap: true,
      wordWrapWidth: width,
      breakWords: true,
    },
  });
  view.anchor.set(0.5);
  return view;
}

export class RevisionCardContentRenderer {
  render(card: RevisionCard): Container {
    const root = new Container();
    const inset = 22;
    const contentWidth = Math.max(40, card.width - inset * 2);
    const badge = label(card.revisionKind === "basic" ? "BASIC" : "CLOZE", 10, 0x64748b, contentWidth);
    badge.anchor.set(0, 0);
    badge.position.set(inset, 12);
    root.addChild(badge);

    if (card.revisionKind === "cloze") {
      const source = card.cloze.replace(/\{\{c\d+::(.*?)(?:::[^}]*)?\}\}/g, "[$1]");
      const body = label(source || "Add cloze text", 17, 0x1f2937, contentWidth);
      body.position.set(card.width / 2, card.height / 2 + 6);
      root.addChild(body);
      return root;
    }

    const divider = new Graphics()
      .moveTo(inset, card.height / 2)
      .lineTo(card.width - inset, card.height / 2)
      .stroke({ color: 0xd4d4d8, width: 1 });
    const front = label(card.front || "Question", 18, 0x1f2937, contentWidth);
    const back = label(card.back || "Answer", 15, 0x475569, contentWidth);
    front.position.set(card.width / 2, card.height * 0.29);
    back.position.set(card.width / 2, card.height * 0.72);
    root.addChild(divider, front, back);
    return root;
  }
}

export const revisionCardContentRenderer = new RevisionCardContentRenderer();
