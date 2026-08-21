import { Texture } from "pixi.js";
import mathjaxSvgBundleUrl from "mathjax/tex-svg.js?url";
import type { CanvasElement } from "../types/elements";

type BrowserMathJax = {
  startup?: { promise?: Promise<void>; typeset?: boolean };
  svg?: unknown;
  tex?: unknown;
  tex2svg?: (source: string, options?: { display?: boolean }) => Element;
};
type Size = { width: number; height: number };
const mathWindow = window as Window & { MathJax?: BrowserMathJax };
const textures = new Map<string, Texture>();
const sizes = new Map<string, Size>();
const viewBoxes = new Map<string, Size>();
const loading = new Set<string>();
const failed = new Set<string>();
const compileErrors = new Set<string>();
let mathJaxPromise: Promise<BrowserMathJax> | null = null;
let onChange: (() => void) | undefined;

export function configureLatexRenderer(callback: () => void) {
  onChange = callback;
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
export function latexRenderedSize(
  element: Extract<CanvasElement, { type: "text" }>,
  texture?: Texture,
) {
  const viewBox = latexViewBox(element.text);
  if (viewBox) {
    const scale = element.fontSize / 1000;
    return {
      width: Math.max(1, viewBox.width * scale),
      height: Math.max(1, viewBox.height * scale),
    };
  }
  const natural =
    latexNaturalSize(element.text) ??
    (texture
      ? { width: texture.width, height: texture.height }
      : { width: element.fontSize, height: element.fontSize });
  const height = Math.ceil(element.fontSize);
  return {
    width: Math.max(24, Math.ceil((natural.width / Math.max(1, natural.height)) * height)),
    height,
  };
}
export function fitLatexElementToNaturalSize(element: CanvasElement) {
  if (element.type !== "text" || element.variant !== "latex") return false;
  const texture = latexTextureFor(element.text);
  if (!texture) return false;
  const size = latexRenderedSize(element, texture);
  const width = size.width + element.padding + element.rightPadding();
  const height = size.height + element.padding * 2;
  if (Math.abs(element.width - width) < 0.5 && Math.abs(element.height - height) < 0.5)
    return false;
  element.width = width;
  element.height = height;
  return true;
}

export function latexTextureFor(source: string) {
  const key = source || "\\;";
  const cached = textures.get(key);
  if (cached) return cached;
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
        onChange?.();
      };
      image.onerror = () => {
        loading.delete(key);
        failed.add(key);
        onChange?.();
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    })
    .catch(() => {
      loading.delete(key);
      failed.add(key);
      onChange?.();
    });
  return null;
}

function ensureMathJax() {
  if (mathWindow.MathJax?.tex2svg) return Promise.resolve(mathWindow.MathJax);
  if (mathJaxPromise) return mathJaxPromise;
  mathWindow.MathJax = {
    ...mathWindow.MathJax,
    startup: { typeset: false },
    svg: { fontCache: "none" },
    tex: { packages: { "[+]": ["ams", "newcommand", "noundefined"] } },
  };
  mathJaxPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = mathjaxSvgBundleUrl;
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
  return mathJaxPromise;
}
