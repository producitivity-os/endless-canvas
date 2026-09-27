export function imageRequestNeedsCors(src: string) {
  return /^(?:https?|media):\/\//i.test(src);
}

export function normalizeImageSource(src?: string): string {
  return src?.trim() ?? "";
}

export function imageSourceCandidates(previewSrc?: string, src?: string): string[] {
  const candidates = [previewSrc, src]
    .map(normalizeImageSource)
    .filter(Boolean);
  return [...new Set(candidates)];
}
