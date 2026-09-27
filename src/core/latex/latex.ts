import { Texture } from "pixi.js";
import mathjaxStartupUrl from "mathjax/tex-svg.js?url";

type BrowserMathJax = {
  startup?: { promise?: Promise<void>; typeset?: boolean };
  svg?: unknown;
  tex?: unknown;
  options?: unknown;
  tex2svg?: (source: string, options?: { display?: boolean }) => Element;
};
type Size = { width: number; height: number };
const mathWindow = (typeof window === "undefined" ? {} : window) as Window & {
  MathJax?: BrowserMathJax;
};
const textures = new Map<string, Texture>();
const sizes = new Map<string, Size>();
const viewBoxes = new Map<string, Size>();
const inlineSvgs = new Map<string, string>();
const loading = new Set<string>();
const failed = new Set<string>();
const compileErrors = new Set<string>();
let mathJaxPromise: Promise<BrowserMathJax> | null = null;
const changeListeners = new Set<() => void>();

export function configureLatexRenderer(callback: () => void) {
  changeListeners.clear();
  changeListeners.add(callback);
}
export function subscribeLatexRenderer(callback: () => void): () => void {
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
}
export function hasLatexCompileError(source: string) {
  return compileErrors.has(source || "\\;");
}
export function latexViewBox(source: string) {
  return viewBoxes.get(source || "\\;");
}
export function latexNaturalSize(source: string) {
  return sizes.get(source || "\\;");
}
export function latexInlineSvgFor(source: string): string | null {
  const key = source || "\\;";
  const cached = inlineSvgs.get(key);
  if (cached) return cached;
  latexTextureFor(key);
  return null;
}
//FIX: Uncomment this
// export function latexRenderedSize(
//   element: Extract<CanvasObject, { type: "text" }>,
//   texture?: Texture,
// ) {
//   const viewBox = latexViewBox(element.text);
//   if (viewBox) {
//     const scale = element.fontSize / 1000;
//     return {
//       width: Math.max(1, viewBox.width * scale),
//       height: Math.max(1, viewBox.height * scale),
//     };
//   }
//   const natural =
//     latexNaturalSize(element.text) ??
//     (texture
//       ? { width: texture.width, height: texture.height }
//       : { width: element.fontSize, height: element.fontSize });
//   const height = Math.ceil(element.fontSize);
//   return {
//     width: Math.max(24, Math.ceil((natural.width / Math.max(1, natural.height)) * height)),
//     height,
//   };
// }
// export function fitLatexElementToNaturalSize(element: CanvasObject) {
//   if (element.type !== "text" || element.variant !== "latex") return false;
//   const texture = latexTextureFor(element.text);
//   if (!texture) return false;
//   const size = latexRenderedSize(element, texture);
//   const width = size.width + element.padding + element.rightPadding();
//   const height = size.height + element.padding * 2;
//   if (Math.abs(element.width - width) < 0.5 && Math.abs(element.height - height) < 0.5)
//     return false;
//   element.width = width;
//   element.height = height;
//   return true;
// }

export function latexTextureFor(source: string) {
  const key = source || "\\;";
  const cached = textures.get(key);
  if (cached) return cached;
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  if (loading.has(key) || failed.has(key)) return null;
  loading.add(key);
  ensureMathJax()
    .then((mathJax) => {
      let node: Element | undefined;
      try {
        node = mathJax.tex2svg?.(key, { display: true });
        if (node?.querySelector('[data-mml-node="merror"], merror, [data-mjx-error]'))
          throw new Error("Invalid LaTeX.");
      } catch (error) {
        compileErrors.add(key);
        throw error;
      }
      const svg = node?.querySelector("svg");
      if (!svg) {
        compileErrors.add(key);
        throw new Error("MathJax did not produce SVG.");
      }
      compileErrors.delete(key);
      const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
      if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
        viewBoxes.set(key, { width: viewBox[2], height: viewBox[3] });
        const inline = svg.cloneNode(true) as SVGElement;
        // MathJax emits width and height in ex units. Keeping both natural dimensions
        // preserves the glyph scale for multi-line formulas instead of squeezing the
        // complete expression into a forced one-em-high box.
        inline.setAttribute("aria-hidden", "true");
        inlineSvgs.set(key, new XMLSerializer().serializeToString(inline));
        const scale = Math.max(0.072, 64 / Math.max(1, viewBox[2]), 32 / Math.max(1, viewBox[3]));
        svg.setAttribute("width", String(viewBox[2] * scale));
        svg.setAttribute("height", String(viewBox[3] * scale));
      }
      const image = new Image();
      image.onload = () => {
        loading.delete(key);
        const texture = Texture.from(image);
        textures.set(key, texture);
        sizes.set(key, {
          width: image.naturalWidth || image.width || texture.width,
          height: image.naturalHeight || image.height || texture.height,
        });
        notifyChange();
      };
      image.onerror = () => {
        loading.delete(key);
        failed.add(key);
        notifyChange();
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    })
    .catch(() => {
      loading.delete(key);
      if (compileErrors.has(key)) failed.add(key);
      notifyChange();
    });
  return null;
}

function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

function ensureMathJax() {
  if (mathWindow.MathJax?.tex2svg) return Promise.resolve(mathWindow.MathJax);
  if (mathJaxPromise) return mathJaxPromise;
  mathWindow.MathJax = {
    ...mathWindow.MathJax,
    startup: { typeset: false },
    svg: { fontCache: "none" },
    tex: { packages: { "[+]": ["ams", "newcommand", "noundefined"] } },
    options: {
      enableSpeech: false,
      enableEnrichment: false,
      enableExplorer: false,
    },
  };
  const script = document.createElement("script");
  const pending = new Promise<BrowserMathJax>((resolve, reject) => {
    script.src = mathjaxStartupUrl;
    script.async = true;
    script.onload = () =>
      (mathWindow.MathJax?.startup?.promise ?? Promise.resolve()).then(
        () =>
          mathWindow.MathJax?.tex2svg
            ? resolve(mathWindow.MathJax)
            : reject(new Error("MathJax loaded without tex2svg.")),
        reject,
      );
    script.onerror = () => reject(new Error("MathJax failed to load."));
    document.head.appendChild(script);
  });
  mathJaxPromise = pending.catch((error) => {
    mathJaxPromise = null;
    script.remove();
    throw error;
  });
  return mathJaxPromise;
}
