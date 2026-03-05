<script lang="ts">
  import type { PicForm } from '$lib/types';
  import { FORM_OPTIONS } from '$lib/utils/snap';
  import { X } from 'lucide-svelte';

  interface Props {
    onSelect: (form: PicForm) => void;
    onCancel: () => void;
  }

  let { onSelect, onCancel }: Props = $props();

  const FORM_ICONS: Record<PicForm, string> = {
    Earring: '💎',
    Ring: '💍',
    Necklace: '📿',
    Bracelet: '⌚',
  };

  const FORM_COLORS: Record<PicForm, string> = {
    Earring: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 hover:border-amber-400',
    Ring: 'from-red-500/20 to-red-500/5 border-red-500/30 hover:border-red-400',
    Necklace: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 hover:border-purple-400',
    Bracelet: 'from-green-500/20 to-green-500/5 border-green-500/30 hover:border-green-400',
  };
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onCancel(); }} />

<div
  class="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4"
  onclick={onCancel}
  role="presentation"
>
  <div
    class="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    <!-- Header -->
    <div class="p-6 border-b border-slate-800 flex justify-between items-center">
      <div>
        <h3 class="font-black text-sm uppercase tracking-widest text-white">Select Jewelry Type</h3>
        <p class="text-[10px] text-slate-500 uppercase font-bold mt-1">Choose the product form</p>
      </div>
      <button onclick={onCancel} class="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
        <X class="w-6 h-6" />
      </button>
    </div>

    <!-- Options -->
    <div class="p-6 grid grid-cols-2 gap-3">
      {#each FORM_OPTIONS as form}
        <button
          onclick={() => onSelect(form)}
          class="p-6 rounded-2xl border bg-gradient-to-br {FORM_COLORS[form]} transition-all active:scale-95 flex flex-col items-center gap-3"
        >
          <span class="text-3xl">{FORM_ICONS[form]}</span>
          <span class="text-[11px] font-black uppercase tracking-widest text-white">{form}</span>
        </button>
      {/each}
    </div>
  </div>
</div>
