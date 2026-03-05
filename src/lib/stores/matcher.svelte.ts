/**
 * Matcher Store — Svelte 5 Runes
 * Manages transforms, shadows, visibility, and matcher-specific state.
 */
import type { TransformState, ShadowConfig } from '$lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TRANSFORM: TransformState = { x: 400, y: 300, scale: 0.5, rotation: 0 };
const DEFAULT_SHADOW: ShadowConfig = {
  enabled: false, opacity: 0.5, blur: 2, x: 1, y: 1, color: '#000000', size: 1.0,
};

// ─── State ───────────────────────────────────────────────────────────────────

let transform = $state<TransformState>({ ...DEFAULT_TRANSFORM });
let shadowConfig = $state<ShadowConfig>({ ...DEFAULT_SHADOW });

let multiTransforms = $state<TransformState[]>([]);
let multiShadows = $state<ShadowConfig[]>([]);
let multiHidden = $state<boolean[]>([]);

// Matcher zoom
let matcherZoomed = $state(false);
let matcherZoomFactor = $state(1.8);

// Multi-drag state
let multiContainerSize = $state({ width: 0, height: 0 });
let multiDragIdx = $state<number | null>(null);
let multiDragStart = $state({ x: 0, y: 0 });
let showMultiAnchors = $state(false);

// ─── Actions ─────────────────────────────────────────────────────────────────

function setTransform(t: TransformState) {
  transform = t;
}

function updateTransform(partial: Partial<TransformState>) {
  transform = { ...transform, ...partial };
}

function setShadowConfig(s: ShadowConfig) {
  shadowConfig = s;
}

function updateShadowConfig(partial: Partial<ShadowConfig>) {
  shadowConfig = { ...shadowConfig, ...partial };
}

// Multi arrays
function addMultiEntry() {
  multiTransforms = [...multiTransforms, { ...DEFAULT_TRANSFORM }];
  multiShadows = [...multiShadows, { ...DEFAULT_SHADOW }];
  multiHidden = [...multiHidden, false];
}

function removeMultiEntry(idx: number) {
  multiTransforms = multiTransforms.filter((_, i) => i !== idx);
  multiShadows = multiShadows.filter((_, i) => i !== idx);
  multiHidden = multiHidden.filter((_, i) => i !== idx);
}

function setMultiTransform(idx: number, t: TransformState) {
  multiTransforms = multiTransforms.map((tr, i) => i === idx ? t : tr);
}

function updateMultiTransform(idx: number, partial: Partial<TransformState>) {
  multiTransforms = multiTransforms.map((tr, i) =>
    i === idx ? { ...tr, ...partial } : tr
  );
}

function setMultiShadow(idx: number, s: ShadowConfig) {
  multiShadows = multiShadows.map((sh, i) => i === idx ? s : sh);
}

function updateMultiShadow(idx: number, partial: Partial<ShadowConfig>) {
  multiShadows = multiShadows.map((sh, i) =>
    i === idx ? { ...sh, ...partial } : sh
  );
}

function toggleMultiHidden(idx: number) {
  multiHidden = multiHidden.map((h, i) => i === idx ? !h : h);
}

function setMultiArrays(transforms: TransformState[], shadows: ShadowConfig[], hidden: boolean[]) {
  multiTransforms = transforms;
  multiShadows = shadows;
  multiHidden = hidden;
}

function clearMultiArrays() {
  multiTransforms = [];
  multiShadows = [];
  multiHidden = [];
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getMatcherStore() {
  return {
    // Single
    get transform() { return transform; },
    get shadowConfig() { return shadowConfig; },
    setTransform,
    updateTransform,
    setShadowConfig,
    updateShadowConfig,

    // Multi arrays
    get multiTransforms() { return multiTransforms; },
    get multiShadows() { return multiShadows; },
    get multiHidden() { return multiHidden; },
    addMultiEntry,
    removeMultiEntry,
    setMultiTransform,
    updateMultiTransform,
    setMultiShadow,
    updateMultiShadow,
    toggleMultiHidden,
    setMultiArrays,
    clearMultiArrays,

    // Zoom
    get matcherZoomed() { return matcherZoomed; },
    set matcherZoomed(v: boolean) { matcherZoomed = v; },
    get matcherZoomFactor() { return matcherZoomFactor; },
    set matcherZoomFactor(v: number) { matcherZoomFactor = v; },

    // Drag
    get multiContainerSize() { return multiContainerSize; },
    set multiContainerSize(v: { width: number; height: number }) { multiContainerSize = v; },
    get multiDragIdx() { return multiDragIdx; },
    set multiDragIdx(v: number | null) { multiDragIdx = v; },
    get multiDragStart() { return multiDragStart; },
    set multiDragStart(v: { x: number; y: number }) { multiDragStart = v; },
    get showMultiAnchors() { return showMultiAnchors; },
    set showMultiAnchors(v: boolean) { showMultiAnchors = v; },

    DEFAULT_TRANSFORM,
    DEFAULT_SHADOW,
  };
}
