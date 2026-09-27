export class CardPresentation {
  showsPreview(editing: boolean | undefined): boolean {
    return !editing;
  }
}

export const cardPresentation = new CardPresentation();
