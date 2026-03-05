/**
 * UI Store — Svelte 5 Runes
 * Manages workflow tabs, processing state, modals, and layout info.
 */
import type { AppWorkflow, PicForm } from '$lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FormSelectModalState {
  onSelect: (form: PicForm) => void;
}

export interface ValidationModalState {
  message: string;
  previewUrl?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onExtra?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  extraLabel?: string;
  confirmStyle?: string;
  extraStyle?: string;
}

export interface LayoutRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

// ─── State ───────────────────────────────────────────────────────────────────

let currentWorkflow = $state<AppWorkflow>('MagicModel');
let helpTarget = $state<string | null>(null);
let isProcessing = $state(false);
let croppingTarget = $state<'ModelShot' | 'ProductShot' | null>(null);

// Modals
let formSelectModal = $state<FormSelectModalState | null>(null);
let validationModal = $state<ValidationModalState | null>(null);

// Layout measurements (set by canvas/container components)
let modelLayout = $state<LayoutRect | null>(null);
let productLayout = $state<LayoutRect | null>(null);

// Batch
let batchFiles = $state<{ url: string; name: string }[]>([]);
let batchConfirmPending = $state(false);

// ─── Actions ─────────────────────────────────────────────────────────────────

function setWorkflow(wf: AppWorkflow) {
  currentWorkflow = wf;
  formSelectModal = null;  // defensiv: alle Modals schließen beim Tab-Wechsel
  validationModal = null;
}

function showHelp(target: string | null = null) {
  helpTarget = target;
  currentWorkflow = 'MagicHelp';
}

function setProcessing(v: boolean) {
  isProcessing = v;
}

function openFormSelect(onSelect: (form: PicForm) => void) {
  formSelectModal = { onSelect };
}

function closeFormSelect() {
  formSelectModal = null;
}

function openValidation(config: ValidationModalState) {
  validationModal = config;
}

function closeValidation() {
  validationModal = null;
}

function setCroppingTarget(target: 'ModelShot' | 'ProductShot' | null) {
  croppingTarget = target;
}

// Batch
function setBatchFiles(files: { url: string; name: string }[]) {
  batchFiles = files;
}

function clearBatchFiles() {
  batchFiles = [];
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getUIStore() {
  return {
    get currentWorkflow() { return currentWorkflow; },
    set currentWorkflow(v: AppWorkflow) { currentWorkflow = v; },
    get helpTarget() { return helpTarget; },
    get isProcessing() { return isProcessing; },
    get croppingTarget() { return croppingTarget; },
    get formSelectModal() { return formSelectModal; },
    get validationModal() { return validationModal; },
    get modelLayout() { return modelLayout; },
    set modelLayout(v: LayoutRect | null) { modelLayout = v; },
    get productLayout() { return productLayout; },
    set productLayout(v: LayoutRect | null) { productLayout = v; },
    get batchFiles() { return batchFiles; },
    get batchConfirmPending() { return batchConfirmPending; },
    set batchConfirmPending(v: boolean) { batchConfirmPending = v; },
    setWorkflow,
    showHelp,
    setProcessing,
    openFormSelect,
    closeFormSelect,
    openValidation,
    closeValidation,
    setCroppingTarget,
    setBatchFiles,
    clearBatchFiles,
  };
}
