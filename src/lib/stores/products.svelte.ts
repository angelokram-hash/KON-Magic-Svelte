/**
 * Products Store — Svelte 5 Runes
 * Manages single product, multi-products, and product-related state.
 */
import type { ProductImageState, PicForm, ShadowConfig } from '$lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_SHADOW: ShadowConfig = {
  enabled: false, opacity: 0.5, blur: 2, x: 1, y: 1, color: '#000000', size: 1.0,
};

export const DEFAULT_PRODUCT_PROMPT = "Indentify the visible Parts of the Jewellery on that Picture. Remove everything else.";

// ─── Single Product State ────────────────────────────────────────────────────

let productShot = $state<ProductImageState | null>(null);
let productShotDims = $state<{ width: number; height: number } | null>(null);
let isProductDirty = $state(false);
let productPrompt = $state(DEFAULT_PRODUCT_PROMPT);

// ─── Multi-Product State (Matcher) ──────────────────────────────────────────

let multiProducts = $state<ProductImageState[]>([]);
let activeMultiIdx = $state(0);

// ─── Actions: Single Product ─────────────────────────────────────────────────

function setProductShot(shot: ProductImageState | null) {
  productShot = shot;
  isProductDirty = false;
}

function updateProductShot(partial: Partial<ProductImageState>) {
  if (!productShot) return;
  const urlChanged = partial.url !== undefined && partial.url !== productShot.url;
  productShot = { ...productShot, ...partial } as ProductImageState;
  if (urlChanged) {
    // URL hat sich geändert (z.B. nach Crop / AI BG-Remove) → Anchors sind ungültig
    productShot.productAnchorC = null;
    productShot.productAnchorL = null;
    productShot.productAnchorR = null;
  }
  isProductDirty = true;
}

function setProductDims(dims: { width: number; height: number } | null) {
  productShotDims = dims;
}

function markProductClean() {
  isProductDirty = false;
}

// ─── Actions: Multi-Products ─────────────────────────────────────────────────

function addProduct(product: ProductImageState) {
  multiProducts = [...multiProducts, product];
}

function removeProduct(idx: number) {
  multiProducts = multiProducts.filter((_, i) => i !== idx);
  if (activeMultiIdx >= multiProducts.length) {
    activeMultiIdx = Math.max(0, multiProducts.length - 1);
  }
}

function updateProduct(idx: number, partial: Partial<ProductImageState>) {
  multiProducts = multiProducts.map((p, i) =>
    i === idx ? { ...p, ...partial } as ProductImageState : p
  );
}

function setMultiProducts(products: ProductImageState[]) {
  multiProducts = products;
  activeMultiIdx = 0;
}

function clearMultiProducts() {
  multiProducts = [];
  activeMultiIdx = 0;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getProductsStore() {
  return {
    // Single product
    get productShot() { return productShot; },
    get productShotDims() { return productShotDims; },
    get isProductDirty() { return isProductDirty; },
    get productPrompt() { return productPrompt; },
    set productPrompt(v: string) { productPrompt = v; },
    setProductShot,
    updateProductShot,
    setProductDims,
    markProductClean,

    // Multi products
    get multiProducts() { return multiProducts; },
    get activeMultiIdx() { return activeMultiIdx; },
    set activeMultiIdx(v: number) { activeMultiIdx = v; },
    get activeProduct(): ProductImageState | null { return multiProducts[activeMultiIdx] ?? null; },
    addProduct,
    removeProduct,
    updateProduct,
    setMultiProducts,
    clearMultiProducts,
  };
}
