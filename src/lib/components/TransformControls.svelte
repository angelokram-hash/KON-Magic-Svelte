<script lang="ts">
  import type { TransformState, ShadowConfig } from '$lib/types';
  import { Moon } from 'lucide-svelte';

  interface Props {
    transform: TransformState;
    onChange: (updates: Partial<TransformState>) => void;
    shadowConfig: ShadowConfig;
    onShadowChange: (updates: Partial<ShadowConfig>) => void;
  }

  let { transform, onChange, shadowConfig, onShadowChange }: Props = $props();
</script>

{#snippet controlRow(label: string, value: number, min: number, max: number, step: number, unit: string, isPercent: boolean, onUpdate: (val: number) => void)}
  <div class="space-y-2">
    <div class="flex justify-between items-center">
      <span class="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div class="flex items-center gap-1.5">
        <input
          type="number"
          {value}
          {step}
          oninput={(e) => onUpdate(parseFloat((e.target as HTMLInputElement).value) || 0)}
          class="w-16 bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-[13px] font-bold text-white text-right focus:border-blue-500 focus:outline-none"
        />
        <span class="text-[11px] font-bold text-slate-500 w-4">{unit || (isPercent ? '%' : '')}</span>
      </div>
    </div>
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={(e) => onUpdate(parseFloat((e.target as HTMLInputElement).value))}
      class="w-full"
    />
  </div>
{/snippet}

<div class="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 lg:space-y-8">
  <!-- SECTION: ATMOSPHERE -->
  <section class="space-y-4">
    <h2 class="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Atmosphere</h2>
    <div class="bg-white/5 rounded-2xl overflow-hidden border border-white/5">
      <div class="ios-row justify-between">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
            <Moon class="w-4 h-4 text-white" />
          </div>
          <span class="text-[15px] font-medium">Drop Shadow</span>
        </div>
        <button
          onclick={() => onShadowChange({ enabled: !shadowConfig.enabled })}
          class="w-[51px] h-[31px] rounded-full transition-all relative {shadowConfig.enabled ? 'bg-[#34C759]' : 'bg-white/10'}"
        >
          <div class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full transition-all shadow-md {shadowConfig.enabled ? 'left-[22px]' : 'left-[2px]'}"></div>
        </button>
      </div>

      {#if shadowConfig.enabled}
        <div class="p-5 space-y-6 bg-black/20 border-t border-white/5">
          <div class="flex justify-between items-center">
            <span class="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Color</span>
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-full border border-white/20 shadow-inner overflow-hidden relative"
                style="background-color: {shadowConfig.color}"
              >
                <input
                  type="color"
                  value={shadowConfig.color}
                  oninput={(e) => onShadowChange({ color: (e.target as HTMLInputElement).value })}
                  class="absolute inset-0 opacity-0 cursor-pointer scale-150"
                />
              </div>
              <input
                type="text"
                value={shadowConfig.color.toUpperCase()}
                oninput={(e) => onShadowChange({ color: (e.target as HTMLInputElement).value })}
                class="w-20 bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          {@render controlRow('Horizontal Offset', shadowConfig.x, -20, 20, 0.1, '%', false, (x) => onShadowChange({ x }))}
          {@render controlRow('Vertical Offset', shadowConfig.y, -20, 20, 0.1, '%', false, (y) => onShadowChange({ y }))}
          {@render controlRow('Shadow Size (Spread)', shadowConfig.size || 1.0, 0.5, 5.0, 0.1, '', false, (size) => onShadowChange({ size }))}
          {@render controlRow('Softness (Blur)', shadowConfig.blur, 0, 15, 0.1, '%', false, (blur) => onShadowChange({ blur }))}
          {@render controlRow('Opacity', shadowConfig.opacity, 0, 1, 0.01, '', true, (opacity) => onShadowChange({ opacity }))}
        </div>
      {/if}
    </div>
  </section>

  <div class="pt-4 flex flex-col items-center gap-2 text-slate-700">
    <span class="text-[9px] font-bold uppercase tracking-widest">Konplott Internal Tool</span>
    <span class="text-[8px] opacity-40">v5.0.0 (Svelte 5)</span>
  </div>
</div>
