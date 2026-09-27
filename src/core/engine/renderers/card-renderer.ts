import { Container, Graphics, Sprite, Text } from "pixi.js";
import {
  materializeTemplateCard,
  TextObject,
  type CanvasCardObject,
  type CardTemplateProvider,
  type TemplateCard,
  type RevisionCard,
  type PluginCard,
  type CanvasPluginCardProvider,
} from "../../model";
import { markdownTextRenderer } from "../../markdown";
import type { CanvasRenderContext, ElementRenderer } from "./renderer";
import type { CardPreviewProvider } from "./card-preview-cache";
import { cardPresentation } from "./card-presentation";
import { cardBorderGeometry } from "./card-border-geometry";
import { markdownCardLayout } from "./markdown-card-layout";
import { markdownTypography } from "../../markdown/markdown-typography";
import { revisionCardContentRenderer } from "./revision-card-content";
import { imageTextureRevision } from "../../model/image";

interface RetainedCardView {
  root: Container;
  background: Container;
  content: Container;
  backgroundKey: string;
  contentKey: string;
  markdownObjectId: string | null;
}

export class CardRenderer implements ElementRenderer<CanvasCardObject> {
  private readonly previews?: CardPreviewProvider;
  private readonly templates?: CardTemplateProvider;
  private readonly plugins?: CanvasPluginCardProvider;
  private readonly views = new WeakMap<Container, RetainedCardView>();

  constructor(
    previews?: CardPreviewProvider,
    templates?: CardTemplateProvider,
    plugins?: CanvasPluginCardProvider,
  ) {
    this.previews = previews;
    this.templates = templates;
    this.plugins = plugins;
  }

  render(target: Container, card: CanvasCardObject, context: CanvasRenderContext): void {
    this.reconcile(target, card, context);
  }

  reconcile(target: Container, card: CanvasCardObject, context: CanvasRenderContext): void {
    const view = this.viewFor(target);
    view.root.position.set(card.x + card.width / 2, card.y + card.height / 2);
    view.root.pivot.set(card.width / 2, card.height / 2);
    view.root.rotation = card.rotation;
    view.root.alpha = card.opacity;
    this.updateBackground(view, card);
    this.updateContent(view, card, context);
  }

  dispose(target: Container, objectId: string): void {
    const view = this.views.get(target);
    if (view?.markdownObjectId) markdownTextRenderer.dispose(view.markdownObjectId);
    else markdownTextRenderer.dispose(`${objectId}::markdown-preview`);
    this.views.delete(target);
  }

  private viewFor(target: Container): RetainedCardView {
    const retained = this.views.get(target);
    if (retained) return retained;
    const root = new Container();
    const view: RetainedCardView = {
      root,
      background: new Container(),
      content: new Container(),
      backgroundKey: "",
      contentKey: "",
      markdownObjectId: null,
    };
    root.addChild(view.background, view.content);
    target.addChild(root);
    this.views.set(target, view);
    return view;
  }

  private updateBackground(view: RetainedCardView, card: CanvasCardObject): void {
    const key = JSON.stringify([card.width, card.height, card.backgroundColor]);
    if (view.backgroundKey === key) return;
    this.clear(view.background);
    const radius = cardBorderGeometry.radiusFor(card.width, card.height);
    view.background.addChild(
      new Graphics()
        .roundRect(0, 0, card.width, card.height, radius)
        .fill({ color: card.backgroundColor ?? 0xffffff })
        .stroke({ color: 0xd4d4d8, width: 1 }),
    );
    view.backgroundKey = key;
  }

  private updateContent(
    view: RetainedCardView,
    card: CanvasCardObject,
    context: CanvasRenderContext,
  ): void {
    if (card.kind === "revision") {
      this.updateRevisionContent(view, card as RevisionCard);
      return;
    }
    if (card.kind === "plugin") {
      this.updatePluginContent(view, card as PluginCard, context);
      return;
    }
    if (card.kind === "template") {
      this.updateTemplateContent(view, card as TemplateCard);
      return;
    }
    if (card.kind === "markdown") {
      view.content.visible = cardPresentation.showsPreview(context.editing);
      if (!view.content.visible) return;
      const text = this.markdownText(card);
      const key = JSON.stringify(["markdown", card.height, markdownTextRenderer.contentKey(text)]);
      if (view.contentKey === key) return;
      this.clearContent(view);
      const content = markdownTextRenderer.create(text);
      content.position.set(markdownCardLayout.sidePadding, markdownCardLayout.topPadding);
      const mask = new Graphics()
        .roundRect(
          markdownCardLayout.sidePadding,
          markdownCardLayout.topPadding,
          markdownCardLayout.contentWidth(card.width),
          markdownCardLayout.contentHeight(card.height),
          4,
        )
        .fill({ color: 0xffffff });
      content.mask = mask;
      view.content.addChild(mask, content);
      view.contentKey = key;
      view.markdownObjectId = text.id;
      return;
    }

    view.content.visible = true;
    const key = JSON.stringify([
      "canvas",
      card.width,
      card.height,
      this.previews?.revision(card.id) ?? 0,
      this.previews?.needsLivePreview(card) ? markdownTextRenderer.revision : -1,
      imageTextureRevision(),
    ]);
    if (view.contentKey === key) return;
    this.clearContent(view);
    if (this.previews?.needsLivePreview(card)) {
      const live = new Container();
      const mask = new Graphics().rect(0, 0, card.width, card.height).fill({ color: 0xffffff });
      live.mask = mask;
      this.previews.renderLive(live, card);
      view.content.addChild(mask, live);
    } else {
      const texture = this.previews?.textureFor(card);
      if (!texture) {
        view.contentKey = key;
        return;
      }
      const preview = new Sprite(texture);
      preview.eventMode = "none";
      view.content.addChild(preview);
    }
    view.contentKey = key;
  }

  private updateRevisionContent(view: RetainedCardView, card: RevisionCard): void {
    view.content.visible = true;
    const key = JSON.stringify([
      "revision",
      card.width,
      card.height,
      card.revisionKind,
      card.front,
      card.back,
      card.cloze,
    ]);
    if (view.contentKey === key) return;
    this.clearContent(view);
    const content = revisionCardContentRenderer.render(card);
    const mask = new Graphics()
      .roundRect(0, 0, card.width, card.height, 10)
      .fill({ color: 0xffffff });
    content.mask = mask;
    view.content.addChild(mask, content);
    view.contentKey = key;
  }

  private updateTemplateContent(view: RetainedCardView, card: TemplateCard): void {
    view.content.visible = true;
    const definition = this.templates?.get(card.templateId) ?? null;
    if (!definition) {
      const key = JSON.stringify(["missing-template", card.templateId, card.width, card.height]);
      if (view.contentKey === key) return;
      this.clearContent(view);
      const label = new Text({
        text: "Template unavailable",
        style: {
          fill: 0x64748b,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif",
          fontSize: 14,
        },
      });
      label.anchor.set(0.5);
      label.position.set(card.width / 2, card.height / 2);
      view.content.addChild(label);
      view.contentKey = key;
      return;
    }
    const key = JSON.stringify([
      "template",
      definition.id,
      definition.revision,
      definition.width,
      definition.height,
      card.templateValues,
      imageTextureRevision(),
    ]);
    if (view.contentKey === key) return;
    if (view.contentKey) this.previews?.invalidate(card.id);
    this.clearContent(view);
    const resolved = materializeTemplateCard(card, definition);
    if (this.previews?.needsLivePreview(resolved)) {
      this.previews.renderLive(view.content, resolved);
    } else {
      const texture = this.previews?.textureFor(resolved);
      if (texture) {
        const preview = new Sprite(texture);
        preview.eventMode = "none";
        view.content.addChild(preview);
      }
    }
    view.contentKey = key;
  }

  private updatePluginContent(
    view: RetainedCardView,
    card: PluginCard,
    context: CanvasRenderContext,
  ): void {
    view.content.visible = true;
    const definition = this.plugins?.get(card.pluginId) ?? null;
    const key = JSON.stringify([
      "plugin",
      card.pluginId,
      card.pluginVersion,
      card.width,
      card.height,
      card.pluginData,
      context.hovered,
      context.hoveredRegionId,
      context.selected,
      context.interactionColor,
      imageTextureRevision(),
    ]);
    if (view.contentKey === key) return;
    if (view.contentKey) this.previews?.invalidate(card.id);
    this.clearContent(view);
    if (!definition) {
      const label = new Text({
        text: "Plugin unavailable",
        style: {
          fill: 0x64748b,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif",
          fontSize: 14,
        },
      });
      label.anchor.set(0.5);
      label.position.set(card.width / 2, card.height / 2);
      view.content.addChild(label);
      view.contentKey = key;
      return;
    }
    const resolved = definition.materialize(card, {
      hovered: context.hovered,
      hoveredRegionId: context.hoveredRegionId,
      selected: context.selected,
      interactionColor: context.interactionColor,
    });
    if (this.previews?.needsLivePreview(resolved)) {
      this.previews.renderLive(view.content, resolved);
    } else {
      const texture = this.previews?.textureFor(resolved);
      if (texture) {
        const preview = new Sprite(texture);
        preview.eventMode = "none";
        view.content.addChild(preview);
      }
    }
    view.contentKey = key;
  }

  private markdownText(card: CanvasCardObject): TextObject {
    return new TextObject({
      id: `${card.id}::markdown-preview`,
      type: "text",
      x: 0,
      y: 0,
      width: markdownCardLayout.contentWidth(card.width),
      height: markdownCardLayout.contentHeight(card.height),
      text: card.markdown || "Write Markdown",
      format: "markdown",
      sizing: "fixed",
      minHeight: 1,
      fontSize: markdownTypography.fontSize,
      lineHeight: markdownTypography.lineHeight,
      color: card.markdown ? 0x1f2530 : 0x94a3b8,
      padding: 0,
    });
  }

  private clearContent(view: RetainedCardView): void {
    if (view.markdownObjectId) markdownTextRenderer.dispose(view.markdownObjectId);
    view.markdownObjectId = null;
    this.clear(view.content);
  }

  private clear(container: Container): void {
    for (const child of container.removeChildren()) child.destroy({ children: true });
  }
}
