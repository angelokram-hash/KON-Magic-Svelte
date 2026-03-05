<script lang="ts">
  import { User, Package, Layers, Play, Info, MessageSquareText, Wand2, Key } from 'lucide-svelte';
  import type { AppWorkflow } from '$lib/types';

  interface Props {
    currentWorkflow: AppWorkflow;
    onWorkflowChange: (wf: AppWorkflow) => void;
    onApiKeyClick?: () => void;
  }

  let { currentWorkflow, onWorkflowChange, onApiKeyClick }: Props = $props();

  const TABS: { wf: AppWorkflow; label: string; icon: typeof User }[] = [
    { wf: 'MagicModel',      label: 'Model',   icon: User },
    { wf: 'MagicProductShot', label: 'Product', icon: Package },
    { wf: 'MagicMatcher',    label: 'Matcher',  icon: Layers },
    { wf: 'MagicBatch',      label: 'Batch',    icon: Play },
    { wf: 'MagicInfo',       label: 'Info',     icon: Info },
    { wf: 'MagicHelp',       label: 'Help',     icon: MessageSquareText },
  ];
</script>

<header class="h-14 sm:h-20 lg:h-24 flex items-center justify-between px-3 sm:px-6 lg:px-12 fixed top-0 w-full z-[300] pointer-events-none">
  <!-- Logo -->
  <div class="flex items-center gap-2 sm:gap-4 pointer-events-auto flex-shrink-0">
    <div class="w-8 h-8 sm:w-11 sm:h-11 lg:w-12 lg:h-12 bg-indigo-600 rounded-[0.875rem] sm:rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-indigo-600/20">
      <Wand2 class="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
    </div>
    <div>
      <h1 class="text-[11px] sm:text-[13px] lg:text-[15px] font-black uppercase tracking-[0.25em] sm:tracking-[0.4em] text-white">Magic Suite</h1>
      <p class="hidden sm:block text-[9px] text-indigo-400 font-black uppercase tracking-widest">v5.0.0 · Svelte 5</p>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="ios-segmented pointer-events-auto p-1 sm:p-1.5 bg-white/15 backdrop-blur-2xl border border-white/25 rounded-[1rem] sm:rounded-[1.5rem] shadow-2xl flex items-center gap-0.5 sm:gap-1">
    {#each TABS as tab}
      <button
        onclick={() => onWorkflowChange(tab.wf)}
        class="flex items-center gap-1 sm:gap-3 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-[0.625rem] sm:rounded-[1rem] transition-all duration-500 text-[11px] sm:text-[12px] font-black uppercase tracking-widest {currentWorkflow === tab.wf ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'text-slate-300 hover:text-white hover:bg-white/10'}"
      >
        <tab.icon class="w-4 h-4" />
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Right side: API Key -->
  <div class="flex items-center gap-2 sm:gap-3 pointer-events-auto flex-shrink-0">
    {#if onApiKeyClick}
      <button
        onclick={onApiKeyClick}
        title="API Key wechseln"
        class="p-2 sm:p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl sm:rounded-2xl text-slate-400 hover:text-indigo-400 transition-all active:scale-95 group flex items-center gap-2"
      >
        <Key class="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
        <span class="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Key wechseln</span>
      </button>
    {/if}
  </div>
</header>
