<script lang="ts">
  import { getModelStore } from '$lib/stores/model.svelte';
  import { getProductsStore } from '$lib/stores/products.svelte';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import { buildProduktList } from '$lib/utils/snap';
  import { Info, User, Package, MessageSquareText } from 'lucide-svelte';

  const model = getModelStore();
  const products = getProductsStore();
  const ui = getUIStore();

  let modelKeys = $derived(model.modelShot ? [
    { key: 'PicType', value: 'ModelShot' },
    { key: 'ModelPicId', value: model.modelShot.modelPicId?.toString() ?? '—' },
    { key: 'ModelSkin', value: model.modelShot.modelSkin ?? '—' },
    { key: 'PicX', value: model.modelShot.picX.toString() },
    { key: 'ModelAnchorEarC', value: model.modelShot.modelAnchorEarC ? `${model.modelShot.modelAnchorEarC.x.toFixed(3)}, ${model.modelShot.modelAnchorEarC.y.toFixed(3)}` : '—' },
    { key: 'ModelAnchorRingC', value: model.modelShot.modelAnchorRingC ? `${model.modelShot.modelAnchorRingC.x.toFixed(3)}, ${model.modelShot.modelAnchorRingC.y.toFixed(3)}` : '—' },
    { key: 'ModelAnchorNecklaceL', value: model.modelShot.modelAnchorNecklaceL ? `${model.modelShot.modelAnchorNecklaceL.x.toFixed(3)}, ${model.modelShot.modelAnchorNecklaceL.y.toFixed(3)}` : '—' },
    { key: 'ModelAnchorNecklaceR', value: model.modelShot.modelAnchorNecklaceR ? `${model.modelShot.modelAnchorNecklaceR.x.toFixed(3)}, ${model.modelShot.modelAnchorNecklaceR.y.toFixed(3)}` : '—' },
    { key: 'ModelAnchorBraceletL', value: model.modelShot.modelAnchorBraceletL ? `${model.modelShot.modelAnchorBraceletL.x.toFixed(3)}, ${model.modelShot.modelAnchorBraceletL.y.toFixed(3)}` : '—' },
    { key: 'ModelAnchorBraceletR', value: model.modelShot.modelAnchorBraceletR ? `${model.modelShot.modelAnchorBraceletR.x.toFixed(3)}, ${model.modelShot.modelAnchorBraceletR.y.toFixed(3)}` : '—' },
    { key: 'ProduktList', value: buildProduktList(products.multiProducts) || '—' },
  ] : []);
</script>

<div class="col-span-12 animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-4 sm:space-y-6">
  <div class="flex items-center gap-3 mb-2">
    <Info class="w-5 h-5 text-indigo-400" />
    <h2 class="text-[14px] font-black uppercase tracking-widest text-white">PNG Metadata Übersicht</h2>
    <button onclick={() => ui.showHelp('help-metadata')} title="Help: Metadata Reference" class="ml-auto p-2 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-xl text-slate-400 hover:text-indigo-400 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
      <MessageSquareText class="w-3.5 h-3.5" /><span class="hidden sm:inline">Help</span>
    </button>
  </div>

  <!-- Model Shot Keys -->
  <div class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
    <div class="flex items-center gap-2 mb-3">
      <User class="w-4 h-4 text-indigo-400" />
      <h3 class="text-[12px] font-black uppercase tracking-widest text-indigo-300">Model Shot</h3>
      {#if !model.modelShot}
        <span class="ml-auto text-[9px] font-black text-slate-500 uppercase tracking-widest">Kein Model geladen</span>
      {/if}
    </div>
    {#if model.modelShot}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {#each modelKeys as { key, value }}
          <div class="flex flex-col gap-0.5 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
            <span class="text-[9px] font-black uppercase tracking-widest text-indigo-400">{key}</span>
            <span class="text-[11px] font-mono text-white break-all">{value}</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-slate-600 text-[11px] font-black uppercase tracking-widest text-center py-4">Kein Model geladen</p>
    {/if}
  </div>

  <!-- Per Product -->
  {#if products.multiProducts.length > 0}
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <Package class="w-4 h-4 text-indigo-400" />
        <h3 class="text-[12px] font-black uppercase tracking-widest text-indigo-300">Produkt Shots ({products.multiProducts.length})</h3>
      </div>
      {#each products.multiProducts as prod, idx}
        <div class="p-4 sm:p-5 rounded-[1.5rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-xl space-y-2">
          <div class="flex items-center gap-2 mb-2">
            <img src={prod.url} class="w-8 h-8 rounded-lg object-contain bg-white/5" alt="" />
            <span class="text-[11px] font-black uppercase tracking-widest text-white">{prod.name}</span>
            <span class="ml-auto text-[9px] font-black text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-2 py-0.5">#{idx + 1}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {#each [
              { key: 'PicType', value: 'ProductShot' },
              { key: 'PicForm', value: prod.picForm },
              { key: 'EAN-Nummer', value: prod.ean || '—' },
              { key: 'PicX', value: prod.picX.toString() },
              { key: 'ProductAnchorC', value: prod.productAnchorC ? `${prod.productAnchorC.x.toFixed(3)}, ${prod.productAnchorC.y.toFixed(3)}` : '—' },
              { key: 'ProductAnchorL', value: prod.productAnchorL ? `${prod.productAnchorL.x.toFixed(3)}, ${prod.productAnchorL.y.toFixed(3)}` : '—' },
              { key: 'ProductAnchorR', value: prod.productAnchorR ? `${prod.productAnchorR.x.toFixed(3)}, ${prod.productAnchorR.y.toFixed(3)}` : '—' },
            ] as { key, value }}
              <div class="flex flex-col gap-0.5 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
                <span class="text-[9px] font-black uppercase tracking-widest text-indigo-400">{key}</span>
                <span class="text-[11px] font-mono text-white break-all">{value}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if products.multiProducts.length === 0 && model.modelShot}
    <p class="text-slate-600 text-[11px] font-black uppercase tracking-widest text-center py-4">Keine Produkte im Matcher geladen</p>
  {/if}
</div>
