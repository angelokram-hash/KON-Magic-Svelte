<script lang="ts">
  import { AlertCircle } from 'lucide-svelte';

  interface Props {
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

  let {
    message, previewUrl, onConfirm, onCancel, onExtra,
    confirmLabel = 'OK', cancelLabel = 'Cancel', extraLabel,
    confirmStyle = 'bg-indigo-600 hover:bg-indigo-500', extraStyle = 'bg-amber-600 hover:bg-amber-500'
  }: Props = $props();

  function handleBackdrop() {
    if (onCancel) onCancel();
    else onConfirm();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') handleBackdrop(); }} />

<div
  class="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4"
  onclick={handleBackdrop}
  role="presentation"
>
  <div
    class="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl max-w-md w-full overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    <!-- Icon + Message -->
    <div class="p-8 text-center">
      <div class="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle class="w-7 h-7 text-amber-400" />
      </div>
      <p class="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{message}</p>
    </div>

    <!-- Optional preview image -->
    {#if previewUrl}
      <div class="px-8 pb-4 flex justify-center">
        <img src={previewUrl} alt="Preview" class="max-h-48 rounded-xl border border-white/10" />
      </div>
    {/if}

    <!-- Actions -->
    <div class="p-6 border-t border-slate-800 flex justify-center gap-3">
      {#if onCancel}
        <button
          onclick={onCancel}
          class="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          {cancelLabel}
        </button>
      {/if}
      {#if onExtra && extraLabel}
        <button
          onclick={onExtra}
          class="px-6 py-2.5 {extraStyle} rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
        >
          {extraLabel}
        </button>
      {/if}
      <button
        onclick={onConfirm}
        class="px-6 py-2.5 {confirmStyle} rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
      >
        {confirmLabel}
      </button>
    </div>
  </div>
</div>
