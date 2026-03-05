/**
 * History Store — Svelte 5 Runes
 * Manages undo stacks for model, product, and matcher states.
 * Max 20 entries per stack.
 */
import type { ModelImageState, ProductImageState, TransformState, ShadowConfig } from '$lib/types';

const MAX_HISTORY = 20;

// ─── State ───────────────────────────────────────────────────────────────────

let modelHistory = $state<ModelImageState[]>([]);
let productHistory = $state<{ shot: ProductImageState; shadow: ShadowConfig }[]>([]);
let matcherHistory = $state<TransformState[]>([]);

// ─── Actions ─────────────────────────────────────────────────────────────────

// Model history
function pushModelState(state: ModelImageState) {
  modelHistory = [...modelHistory.slice(-(MAX_HISTORY - 1)), state];
}

function undoModel(): ModelImageState | null {
  if (modelHistory.length === 0) return null;
  const last = modelHistory[modelHistory.length - 1];
  modelHistory = modelHistory.slice(0, -1);
  return last;
}

// Product history
function pushProductState(shot: ProductImageState, shadow: ShadowConfig) {
  productHistory = [...productHistory.slice(-(MAX_HISTORY - 1)), { shot, shadow }];
}

function undoProduct(): { shot: ProductImageState; shadow: ShadowConfig } | null {
  if (productHistory.length === 0) return null;
  const last = productHistory[productHistory.length - 1];
  productHistory = productHistory.slice(0, -1);
  return last;
}

// Matcher history
function pushMatcherState(state: TransformState) {
  matcherHistory = [...matcherHistory.slice(-(MAX_HISTORY - 1)), state];
}

function undoMatcher(): TransformState | null {
  if (matcherHistory.length === 0) return null;
  const last = matcherHistory[matcherHistory.length - 1];
  matcherHistory = matcherHistory.slice(0, -1);
  return last;
}

// Clear all
function clearHistory() {
  modelHistory = [];
  productHistory = [];
  matcherHistory = [];
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getHistoryStore() {
  return {
    get modelHistory() { return modelHistory; },
    get productHistory() { return productHistory; },
    get matcherHistory() { return matcherHistory; },
    get canUndoModel() { return modelHistory.length > 0; },
    get canUndoProduct() { return productHistory.length > 0; },
    get canUndoMatcher() { return matcherHistory.length > 0; },
    pushModelState,
    undoModel,
    pushProductState,
    undoProduct,
    pushMatcherState,
    undoMatcher,
    clearHistory,
  };
}
