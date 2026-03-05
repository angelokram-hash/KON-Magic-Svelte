<script lang="ts">
  import { getModelStore, MODEL_ANCHOR_SLOTS } from '$lib/stores/model.svelte';
  import { getProductsStore } from '$lib/stores/products.svelte';
  import { getMatcherStore } from '$lib/stores/matcher.svelte';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import { PngMetadata } from '$lib/utils/pngMetadata';
  import { computeSnap, getImageDimensions, getMultiModelBounds, parseAnchor, serializeAnchor, deserializeShadow, serializeShadow, buildProduktList, convertToPngUrl, UI_BASE_WIDTH } from '$lib/utils/snap';
  import { AlertCircle, User, Package, PlusCircle, Play, CheckCircle2, X, MessageSquareText } from 'lucide-svelte';
  import type { ProductImageState, PicForm } from '$lib/types';

  const model = getModelStore();
  const products = getProductsStore();
  const matcher = getMatcherStore();
  const ui = getUIStore();

  let batchFileInputEl: HTMLInputElement | undefined = $state();

  // ─── Batch File Select ─────────────────────────────────────────────────────
  async function handleBatchFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;
    const newFiles: { url: string; name: string }[] = [];
    for (const file of files) {
      try {
        const url = await convertToPngUrl(file);
        newFiles.push({ url, name: file.name });
      } catch { /* skip */ }
    }
    ui.setBatchFiles([...ui.batchFiles, ...newFiles]);
    input.value = '';
  }

  function removeBatchFile(idx: number) {
    ui.setBatchFiles(ui.batchFiles.filter((_, i) => i !== idx));
  }

  // ─── Match All ─────────────────────────────────────────────────────────────
  async function handleMatchAll() {
    if (!model.modelShot || !model.modelShotDims) return;
    ui.setProcessing(true);
    ui.batchConfirmPending = false;

    // Use a virtual canvas size for snapping
    const virtualW = 1200;
    const virtualH = 1600;
    const virtualBounds = getMultiModelBounds(virtualW, virtualH, model.modelShotDims);

    for (const bf of ui.batchFiles) {
      try {
        // Read metadata from file
        const resp = await fetch(bf.url);
        const buf = await resp.arrayBuffer();
        const meta = PngMetadata.getAllMetadata(buf);

        if (meta['pictype'] !== 'ProductShot') continue;

        const prod: ProductImageState = {
          url: bf.url,
          name: bf.name,
          picType: 'ProductShot',
          picForm: (meta['picform'] as PicForm) || 'Earring',
          picX: parseFloat(meta['picx']) || 0,
          ean: meta['ean-nummer'] || '',
          productAnchorC: parseAnchor(meta['productanchorc']),
          productAnchorL: parseAnchor(meta['productanchorl']),
          productAnchorR: parseAnchor(meta['productanchorr']),
        };

        const prodDims = await getImageDimensions(bf.url);
        const snapped = computeSnap(model.modelShot, model.modelShotDims, prod, prodDims, virtualBounds);
        if (!snapped) continue;

        // Render composite
        const canvas = document.createElement('canvas');
        canvas.width = virtualW;
        canvas.height = virtualH;
        const ctx = canvas.getContext('2d')!;

        // Draw model
        const modelImg = await loadImage(model.modelShot.url);
        const mb = virtualBounds;
        ctx.drawImage(modelImg, mb.offsetX, mb.offsetY, mb.renderedW, mb.renderedH);

        // Draw product
        const prodImg = await loadImage(prod.url);
        const pW = UI_BASE_WIDTH * snapped.scale;
        const pH = pW * (prodDims.height / prodDims.width);
        ctx.save();
        ctx.translate(snapped.x, snapped.y);
        ctx.rotate((snapped.rotation * Math.PI) / 180);
        ctx.drawImage(prodImg, -pW / 2, -pH / 2, pW, pH);
        ctx.restore();

        // Export with metadata
        const dataUrl = canvas.toDataURL('image/png');
        const pngResp = await fetch(dataUrl);
        let pngBuf = await pngResp.arrayBuffer();

        const prefix: Record<string, string> = { Earring: 'E', Ring: 'R', Necklace: 'N', Bracelet: 'B' };
        const formP = prefix[prod.picForm] || '?';
        const midStr = model.modelShot.modelPicId ?? 0;
        const eanStr = prod.ean || 'no-ean';
        const fileName = `AI_${midStr}_${formP}_${eanStr}.png`;

        const metaToInject: Record<string, string> = {
          PicType: 'ModelShot',
          ModelPicId: String(model.modelShot.modelPicId ?? ''),
          PicX: String(model.modelShot.picX),
          ProduktList: `${formP} ${eanStr}`,
        };
        pngBuf = PngMetadata.injectMetadata(pngBuf, metaToInject);

        // Download
        const blob = new Blob([pngBuf], { type: 'image/png' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);

        // Small delay between downloads
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error('Batch match error:', err);
      }
    }

    ui.setProcessing(false);
  }

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.src = url;
    });
  }

  // Anchor status badges
  const anchorChecks = $derived(model.modelShot ? [
    { label: 'Ear', ok: !!model.modelShot.modelAnchorEarC },
    { label: 'Ring', ok: !!model.modelShot.modelAnchorRingC },
    { label: 'Neck L', ok: !!model.modelShot.modelAnchorNecklaceL },
    { label: 'Neck R', ok: !!model.modelShot.modelAnchorNecklaceR },
    { label: 'Brace L', ok: !!model.modelShot.modelAnchorBraceletL },
    { label: 'Brace R', ok: !!model.modelShot.modelAnchorBraceletR },
  ] : []);
</script>

<input bind:this={batchFileInputEl} type="file" accept="image/*" multiple class="hidden" onchange={handleBatchFileSelect} />

<div class="col-span-12 animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-4 sm:space-y-6">
  {#if !model.modelShot}
    <!-- No model loaded -->
    <div class="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div class="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center ring-1 ring-amber-500/20 shadow-2xl">
        <AlertCircle class="w-10 h-10 text-amber-400" />
      </div>
      <div class="space-y-2">
        <p class="text-white font-black uppercase tracking-widest text-[14px]">No Model loaded</p>
        <p class="text-slate-500 text-[11px] font-black uppercase tracking-widest">Please load a Model Shot and set anchors first.</p>
      </div>
      <button onclick={() => ui.setWorkflow('MagicModel')} class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
        <User class="w-4 h-4" /><span>Go to Model</span>
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-12 gap-4 sm:gap-6">
      <!-- Left: Model preview -->
      <div class="col-span-12 lg:col-span-4 space-y-4">
        <div class="p-4 sm:p-5 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
          <div class="flex items-center gap-2">
            <User class="w-4 h-4 text-indigo-400" />
            <h3 class="text-[12px] font-black uppercase tracking-widest">Model Shot</h3>
            {#if model.modelShot.modelPicId}
              <span class="text-[9px] font-black text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-2 py-0.5">ID {model.modelShot.modelPicId}</span>
            {/if}
            <button onclick={() => ui.showHelp('help-batch')} title="Help" class="ml-auto p-1.5 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-lg text-slate-400 hover:text-indigo-400 transition-all">
              <MessageSquareText class="w-3 h-3" />
            </button>
          </div>
          <div class="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black/30 border border-white/5 flex items-center justify-center">
            <img src={model.modelShot.url} class="max-w-full max-h-full object-contain" alt="Model" />
          </div>
          <div class="grid grid-cols-3 gap-1 text-[9px] font-black uppercase tracking-widest">
            {#each anchorChecks as { label, ok }}
              <div class="flex items-center gap-1 px-2 py-1 rounded-lg {ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/3 text-slate-600'}">
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {ok ? 'bg-emerald-400' : 'bg-slate-700'}"></span>
                {label}
              </div>
            {/each}
          </div>
        </div>
        <button onclick={() => batchFileInputEl?.click()} class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-[1.5rem] text-white text-[11px] sm:text-[12px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
          <PlusCircle class="w-4 h-4" /><span>Add Product Files</span>
        </button>
      </div>

      <!-- Right: Product list + Match All -->
      <div class="col-span-12 lg:col-span-8 space-y-4">
        <div class="p-4 sm:p-5 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
          <div class="flex items-center gap-2">
            <Package class="w-4 h-4 text-indigo-400" />
            <h3 class="text-[12px] font-black uppercase tracking-widest">Batch Products</h3>
            {#if ui.batchFiles.length > 0}
              <span class="ml-auto text-[9px] font-black text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-2 py-0.5">{ui.batchFiles.length}</span>
            {/if}
          </div>

          {#if ui.batchFiles.length === 0}
            <div class="text-center py-10 text-slate-600 text-[10px] font-black uppercase tracking-widest">No products added yet</div>
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {#each ui.batchFiles as bf, idx}
                <div class="relative group rounded-2xl overflow-hidden border border-white/5 bg-white/3">
                  <div class="aspect-square flex items-center justify-center bg-black/20">
                    <img src={bf.url} class="max-w-full max-h-full object-contain" alt={bf.name} />
                  </div>
                  <div class="px-2 py-1.5">
                    <p class="text-[8px] font-black text-slate-400 truncate">{bf.name}</p>
                  </div>
                  <button
                    onclick={() => removeBatchFile(idx)}
                    class="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X class="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Match All Button -->
        {#if ui.batchFiles.length > 0 && !ui.batchConfirmPending}
          <button onclick={() => { ui.batchConfirmPending = true; }} class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-[1.5rem] text-white text-[12px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
            <Play class="w-4 h-4" /><span>Match All ({ui.batchFiles.length} Products)</span>
          </button>
        {/if}

        {#if ui.batchConfirmPending}
          <div class="p-4 sm:p-5 rounded-[2rem] border bg-amber-500/5 border-amber-500/20 backdrop-blur-xl space-y-3">
            <div class="flex items-center gap-2">
              <AlertCircle class="w-4 h-4 text-amber-400" />
              <p class="text-[11px] font-black uppercase tracking-widest text-amber-300">
                Ready to match {ui.batchFiles.length} products with Model ID {model.modelShot?.modelPicId ?? '?'} and save all?
              </p>
            </div>
            <div class="flex gap-3">
              <button onclick={handleMatchAll} class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                <CheckCircle2 class="w-4 h-4" /><span>Yes, Match All</span>
              </button>
              <button onclick={() => { ui.batchConfirmPending = false; }} class="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-300 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95">
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
