/**
 * Model Store — Svelte 5 Runes
 * Manages the model image, anchor points, and related state.
 */
import type { ModelImageState, AnchorPoint, PicForm } from '$lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

export const MODEL_ANCHOR_SLOTS = [
  { key: 'modelAnchorEarC',      label: 'Ear Center',     color: '#fbbf24', form: 'Earring'  as PicForm, mode: 'C' as const },
  { key: 'modelAnchorRingC',     label: 'Ring Center',    color: '#f87171', form: 'Ring'     as PicForm, mode: 'C' as const },
  { key: 'modelAnchorNecklaceL', label: 'Necklace Left',  color: '#a855f7', form: 'Necklace' as PicForm, mode: 'L' as const },
  { key: 'modelAnchorNecklaceR', label: 'Necklace Right', color: '#ec4899', form: 'Necklace' as PicForm, mode: 'R' as const },
  { key: 'modelAnchorBraceletL', label: 'Bracelet Left',  color: '#4ade80', form: 'Bracelet' as PicForm, mode: 'L' as const },
  { key: 'modelAnchorBraceletR', label: 'Bracelet Right', color: '#60a5fa', form: 'Bracelet' as PicForm, mode: 'R' as const },
] as const;

export type ModelAnchorKey = typeof MODEL_ANCHOR_SLOTS[number]['key'];

export const FORM_COLOR: Record<PicForm, string> = {
  Earring:  '#fbbf24',
  Ring:     '#f87171',
  Necklace: '#a855f7',
  Bracelet: '#4ade80',
};

// ─── State ───────────────────────────────────────────────────────────────────

let modelShot = $state<ModelImageState | null>(null);
let modelShotDims = $state<{ width: number; height: number } | null>(null);
let isModelDirty = $state(false);
let activeModelAnchorKey = $state<ModelAnchorKey>('modelAnchorEarC');

// ─── Actions ─────────────────────────────────────────────────────────────────

function setModelShot(shot: ModelImageState | null) {
  modelShot = shot;
  isModelDirty = false;
}

function updateModelShot(partial: Partial<ModelImageState>) {
  if (!modelShot) return;
  modelShot = { ...modelShot, ...partial } as ModelImageState;
  isModelDirty = true;
}

function setModelAnchor(key: ModelAnchorKey, point: AnchorPoint | null) {
  if (!modelShot) return;
  modelShot = { ...modelShot, [key]: point } as ModelImageState;
  isModelDirty = true;
}

function clearModelAnchor(key: ModelAnchorKey) {
  setModelAnchor(key, null);
}

function setModelDims(dims: { width: number; height: number } | null) {
  modelShotDims = dims;
}

function markModelClean() {
  isModelDirty = false;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getModelStore() {
  return {
    get modelShot() { return modelShot; },
    get modelShotDims() { return modelShotDims; },
    get isModelDirty() { return isModelDirty; },
    get activeModelAnchorKey() { return activeModelAnchorKey; },
    set activeModelAnchorKey(key: ModelAnchorKey) { activeModelAnchorKey = key; },
    setModelShot,
    updateModelShot,
    setModelAnchor,
    clearModelAnchor,
    setModelDims,
    markModelClean,
  };
}
