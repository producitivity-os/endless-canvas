export class MarkdownCardLayout {
  readonly sidePadding = 18;
  readonly topPadding = 18;
  readonly bottomPadding = 18;

  contentWidth(cardWidth: number): number {
    return Math.max(1, cardWidth - this.sidePadding * 2);
  }

  contentHeight(cardHeight: number): number {
    return Math.max(1, cardHeight - this.topPadding - this.bottomPadding);
  }

  cardHeight(contentHeight: number): number {
    return Math.max(1, Math.ceil(contentHeight + this.topPadding + this.bottomPadding));
  }
}

export const markdownCardLayout = new MarkdownCardLayout();
