/**
 * snap.ts — computeSnap() and layout helpers
 *
 * Pure math functions extracted from App.tsx, no framework dependency.
 * Used for auto-positioning jewelry products onto model anchor points.
 */
import type { ModelImageState, ProductImageState, TransformState, AnchorPoint, PicForm, ShadowConfig } from '$lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

export const UI_BASE_WIDTH = 192;
export const FORM_OPTIONS: PicForm[] = ['Earring', 'Ring', 'Necklace', 'Bracelet'];

// ─── Bounds / Layout Helpers ─────────────────────────────────────────────────

export interface RenderBounds {
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
}

export interface LayoutRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * Calculate how an image fits inside a container (object-contain).
 */
export function getImageLayoutRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): LayoutRect | null {
  if (containerW <= 0 || containerH <= 0) return null;
  const containerAspect = containerW / containerH;
  const imageAspect = imageW / imageH;
  let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
  if (imageAspect > containerAspect) {
    renderedW = containerW;
    renderedH = containerW / imageAspect;
    offsetX = 0;
    offsetY = (containerH - renderedH) / 2;
  } else {
    renderedH = containerH;
    renderedW = containerH * imageAspect;
    offsetX = (containerW - renderedW) / 2;
    offsetY = 0;
  }
  return { width: renderedW, height: renderedH, left: offsetX, top: offsetY };
}

/**
 * Calculate render bounds for the model image inside a container.
 */
export function getModelRenderBounds(
  containerW: number,
  containerH: number,
  modelDims: { width: number; height: number }
): RenderBounds {
  const aspect = modelDims.width / modelDims.height;
  const contAspect = containerW / containerH;
  let renderedW = containerW, renderedH = containerH, offsetX = 0, offsetY = 0;
  if (aspect > contAspect) {
    renderedH = containerW / aspect;
    offsetY = (containerH - renderedH) / 2;
  } else {
    renderedW = containerH * aspect;
    offsetX = (containerW - renderedW) / 2;
  }
  return { renderedW, renderedH, offsetX, offsetY };
}

/**
 * Calculate render bounds for multi-container (Matcher tab).
 */
export function getMultiModelBounds(
  containerW: number,
  containerH: number,
  modelDims: { width: number; height: number }
): { cw: number; ch: number } & RenderBounds {
  const bounds = getModelRenderBounds(containerW, containerH, modelDims);
  return { cw: containerW, ch: containerH, ...bounds };
}

// ─── computeSnap ─────────────────────────────────────────────────────────────

/**
 * Computes the snap transform for a product on a model.
 *
 * Center-Mode (Earring/Ring):
 *   - Scale by pixelsPerCm ratio
 *   - Position at model anchor, offset by product anchor
 *
 * Dual-Mode (Necklace/Bracelet):
 *   - Scale by L-R distance ratio
 *   - Rotate to match L-R angle
 *   - Position at model left anchor
 */
export function computeSnap(
  modelShot: ModelImageState,
  modelShotDims: { width: number; height: number },
  prod: ProductImageState,
  prodDims: { width: number; height: number },
  bounds: RenderBounds
): TransformState | null {
  const form = prod.picForm;
  const isDual = form === 'Necklace' || form === 'Bracelet';

  if (isDual) {
    // ─── Dual-Mode: Necklace / Bracelet ──────────────────────────────
    const mLeft  = form === 'Necklace' ? modelShot.modelAnchorNecklaceL : modelShot.modelAnchorBraceletL;
    const mRight = form === 'Necklace' ? modelShot.modelAnchorNecklaceR : modelShot.modelAnchorBraceletR;
    const pLeft  = prod.productAnchorL;
    const pRight = prod.productAnchorR;
    if (!mLeft || !mRight || !pLeft || !pRight) return null;

    const mDistX = (mRight.x - mLeft.x) * (bounds.renderedW / 100);
    const mDistY = (mRight.y - mLeft.y) * (bounds.renderedH / 100);
    const modelDistPx = Math.sqrt(mDistX * mDistX + mDistY * mDistY);

    const pDistX = (pRight.x - pLeft.x) * (UI_BASE_WIDTH / 100);
    const pDistY = (pRight.y - pLeft.y) * ((UI_BASE_WIDTH * (prodDims.height / prodDims.width)) / 100);
    const productDistPx = Math.sqrt(pDistX * pDistX + pDistY * pDistY);

    const newScale = modelDistPx / productDistPx;
    const mAngle = Math.atan2(mDistY, mDistX);
    const pAngle = Math.atan2(pDistY, pDistX);
    const newRotation = (mAngle - pAngle) * (180 / Math.PI);

    const visualW = UI_BASE_WIDTH * newScale;
    const visualH = (visualW * prodDims.height) / prodDims.width;
    const localLeftX = (pLeft.x / 100 - 0.5) * visualW;
    const localLeftY = (pLeft.y / 100 - 0.5) * visualH;
    const rad = (newRotation * Math.PI) / 180;
    const rotX = localLeftX * Math.cos(rad) - localLeftY * Math.sin(rad);
    const rotY = localLeftX * Math.sin(rad) + localLeftY * Math.cos(rad);

    const tX = bounds.offsetX + (mLeft.x / 100) * bounds.renderedW - rotX;
    const tY = bounds.offsetY + (mLeft.y / 100) * bounds.renderedH - rotY;

    return { x: tX, y: tY, scale: newScale, rotation: newRotation };
  } else {
    // ─── Center-Mode: Earring / Ring ─────────────────────────────────
    const mAnchor = form === 'Earring' ? modelShot.modelAnchorEarC : modelShot.modelAnchorRingC;
    const pAnchor = prod.productAnchorC;
    if (!mAnchor || !pAnchor || !modelShot.picX || !prod.picX) return null;

    const pixelsPerCmUI = bounds.renderedH / modelShot.picX;
    const targetUIHeight = prod.picX * pixelsPerCmUI;
    const baseUIHeight = UI_BASE_WIDTH * (prodDims.height / prodDims.width);
    const newScale = targetUIHeight / baseUIHeight;

    const targetX = bounds.offsetX + (mAnchor.x / 100) * bounds.renderedW;
    const targetY = bounds.offsetY + (mAnchor.y / 100) * bounds.renderedH;

    const visualW = UI_BASE_WIDTH * newScale;
    const visualH = (visualW * prodDims.height) / prodDims.width;
    const anchorRelX = (pAnchor.x / 100 - 0.5) * visualW;
    const anchorRelY = (pAnchor.y / 100 - 0.5) * visualH;

    return { x: targetX - anchorRelX, y: targetY - anchorRelY, scale: newScale, rotation: 0 };
  }
}

// ─── Image Utility Functions ─────────────────────────────────────────────────

export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
  });
}

export function formatEAN(val: string): string {
  const digits = val.replace(/\D/g, '').substring(0, 13);
  if (digits.length <= 2) return digits;
  if (digits.length <= 8) return `${digits.substring(0, 2)} ${digits.substring(2, 8)}`;
  if (digits.length <= 13) return `${digits.substring(0, 2)} ${digits.substring(2, 8)} ${digits.substring(8)}`;
  return digits;
}

/**
 * Auto-crops an image by trimming fully-transparent border pixels.
 */
export function autoCropTransparent(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(url); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let top = height, left = width, bottom = 0, right = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 0) {
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (top >= bottom || left >= right) { resolve(url); return; }
      const cropW = right - left + 1;
      const cropH = bottom - top + 1;
      const out = document.createElement('canvas');
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext('2d');
      if (!outCtx) { resolve(url); return; }
      outCtx.clearRect(0, 0, cropW, cropH);
      outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
      resolve(out.toDataURL('image/png'));
    };
    img.src = url;
  });
}

export function buildProduktList(products: ProductImageState[]): string {
  const prefix: Record<string, string> = { Earring: 'E', Ring: 'R', Bracelet: 'B', Necklace: 'N' };
  return products.map(p => `${prefix[p.picForm] || '?'} ${p.ean || 'no-ean'}`).join(' ');
}

export function convertToPngUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context failed');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function makeWhiteTransparent(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(url); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 240 && g > 240 && b > 240) data[i + 3] = 0;
        else if (r > 200 && r < 210 && g > 200 && g < 210 && b > 200 && b < 210) data[i + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}

// ─── Serialization Helpers ───────────────────────────────────────────────────

const DEFAULT_SHADOW: ShadowConfig = {
  enabled: false, opacity: 0.5, blur: 2, x: 1, y: 1, color: '#000000', size: 1.0,
};

export function serializeShadow(s: ShadowConfig): string {
  return `${s.enabled ? 1 : 0}|${s.opacity}|${s.blur}|${s.x}|${s.y}|${s.color}|${s.size}`;
}

export function deserializeShadow(str: string | undefined): ShadowConfig {
  if (!str) return DEFAULT_SHADOW;
  const parts = str.split('|');
  if (parts.length < 6) return DEFAULT_SHADOW;
  return {
    enabled: parts[0] === '1',
    opacity: parseFloat(parts[1]) || 0.5,
    blur: parseFloat(parts[2]) || 2,
    x: parseFloat(parts[3]) || 1,
    y: parseFloat(parts[4]) || 1,
    color: parts[5] || '#000000',
    size: parts[6] ? parseFloat(parts[6]) : 1.0,
  };
}

export function parseAnchor(str: string | undefined): AnchorPoint | null {
  if (!str || str === 'none') return null;
  const parts = str.split(',').map(parseFloat);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { x: parts[0], y: parts[1] };
  return null;
}

export function serializeAnchor(a: AnchorPoint): string {
  return `${a.x.toFixed(2)},${a.y.toFixed(2)}`;
}
