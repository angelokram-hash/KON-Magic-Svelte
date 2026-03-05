<script lang="ts">
  import {
    Camera,
    RefreshCcw,
    Save,
    Sparkles,
    Wand2,
    Undo2,
    Hash,
    X,
    Crosshair,
    MessageSquareText,
    Scissors,
  } from 'lucide-svelte';

  import { getModelStore, MODEL_ANCHOR_SLOTS, type ModelAnchorKey } from '$lib/stores/model.svelte';
  import { getProductsStore } from '$lib/stores/products.svelte';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import { getHistoryStore } from '$lib/stores/history.svelte';

  import {
    getImageDimensions,
    convertToPngUrl,
    parseAnchor,
    serializeAnchor,
    autoCropTransparent,
    makeWhiteTransparent,
    getImageLayoutRect,
    buildProduktList,
  } from '$lib/utils/snap';

  import { PngMetadata } from '$lib/utils/pngMetadata';
  import { GeminiService } from '$lib/services/gemini';
  import type { ModelImageState, AnchorPoint } from '$lib/types';

  // ─── Store Instances ────────────────────────────────────────────────────────

  const model = getModelStore();
  const products = getProductsStore();
  const ui = getUIStore();
  const history = getHistoryStore();

  const gemini = new GeminiService();

  // ─── Local State ────────────────────────────────────────────────────────────

  let modelCanvasEl = $state<HTMLDivElement>();
  let fileInputEl = $state<HTMLInputElement>();

  // Track canvas size as reactive state so $derived can depend on it
  let canvasWidth = $state(0);
  let canvasHeight = $state(0);

  // ─── Resize Observer: keep canvasWidth/canvasHeight in sync ────────────────

  $effect(() => {
    if (!modelCanvasEl) return;
    // Set initial size
    canvasWidth = modelCanvasEl.clientWidth;
    canvasHeight = modelCanvasEl.clientHeight;
    const observer = new ResizeObserver(([entry]) => {
      canvasWidth = entry.contentRect.width;
      canvasHeight = entry.contentRect.height;
    });
    observer.observe(modelCanvasEl);
    return () => observer.disconnect();
  });

  // ─── Derived: pure computation, no side effects ─────────────────────────────

  let modelLayout = $derived.by(() => {
    if (!modelCanvasEl || !model.modelShotDims || canvasWidth <= 0) return null;
    return getImageLayoutRect(
      canvasWidth,
      canvasHeight,
      model.modelShotDims.width,
      model.modelShotDims.height,
    );
  });

  // ─── Sync modelLayout → UI store (side effect belongs in $effect) ──────────

  $effect(() => {
    ui.modelLayout = modelLayout;
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function pushModelHistory() {
    if (model.modelShot) {
      history.pushModelState(JSON.parse(JSON.stringify(model.modelShot)));
    }
  }

  function undoModel() {
    const prev = history.undoModel();
    if (prev) {
      model.setModelShot(prev);
      getImageDimensions(prev.url).then((dims) => model.setModelDims(dims));
    }
  }

  // ─── Validate Model Shot ───────────────────────────────────────────────────

  function validateModelShot(): { isValid: true } | { isValid: false; message: string } {
    const shot = model.modelShot;
    if (!shot) return { isValid: true };
    const hasHeight = shot.picX > 0;
    const hasAnyAnchor = MODEL_ANCHOR_SLOTS.some((s) => shot[s.key] !== null);
    if (!hasHeight || !hasAnyAnchor) {
      const missing: string[] = [];
      if (!hasHeight) missing.push('Ref. Height (cm)');
      if (!hasAnyAnchor) missing.push('at least one Anchor Point');
      return { isValid: false, message: `Warning: You haven't set ${missing.join(' and ')} yet.` };
    }
    return { isValid: true };
  }

  // ─── handleLoadWithCheck: Open file picker ─────────────────────────────────

  function handleLoadWithCheck() {
    fileInputEl?.click();
  }

  // ─── handleFileUpload: Process selected file ──────────────────────────────

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isPngFile = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    let finalUrl = '';

    if (!isPngFile) {
      const confirmed = window.confirm('Not a PNG. Upload anyway?');
      if (!confirmed) {
        input.value = '';
        return;
      }
      ui.setProcessing(true);
      try {
        finalUrl = await convertToPngUrl(file);
      } catch {
        alert('Conversion failed.');
        ui.setProcessing(false);
        input.value = '';
        return;
      } finally {
        ui.setProcessing(false);
      }
    }

    // Read the file as data URL if PNG
    if (isPngFile) {
      finalUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
    }

    // Load model data
    const dims = await getImageDimensions(finalUrl);
    let meta: Record<string, string> = {};

    if (isPngFile) {
      try {
        const buf = await (await fetch(finalUrl)).arrayBuffer();
        if (PngMetadata.isPng(buf)) meta = PngMetadata.getAllMetadata(buf);
      } catch {
        console.warn('Metadata extraction skipped');
      }
    }

    const state: ModelImageState = {
      url: finalUrl,
      name: file.name,
      picType: 'ModelShot',
      picX: parseFloat(meta['PicX'] || '0'),
      modelSkin: meta['ModelSkin'] || undefined,
      modelPicId: meta['ModelPicId'] ? parseInt(meta['ModelPicId']) : undefined,
      modelAnchorEarC: parseAnchor(meta['ModelAnchorEarC']),
      modelAnchorRingC: parseAnchor(meta['ModelAnchorRingC']),
      modelAnchorNecklaceL: parseAnchor(meta['ModelAnchorNecklaceL']),
      modelAnchorNecklaceR: parseAnchor(meta['ModelAnchorNecklaceR']),
      modelAnchorBraceletL: parseAnchor(meta['ModelAnchorBraceletL']),
      modelAnchorBraceletR: parseAnchor(meta['ModelAnchorBraceletR']),
    };

    pushModelHistory();
    model.setModelShot(state);
    model.setModelDims(dims);
    model.markModelClean();

    // Reset file input for re-selecting the same file
    input.value = '';
  }

  // ─── setAnchorAtClick: Set anchor point on canvas click ───────────────────

  function setAnchorAtClick(e: MouseEvent) {
    const container = modelCanvasEl;
    const dims = model.modelShotDims;
    if (!container || !dims || canvasWidth <= 0) return;

    const layout = getImageLayoutRect(
      canvasWidth,    // reactive $state — always up-to-date
      canvasHeight,
      dims.width,
      dims.height,
    );
    if (!layout) return;

    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - layout.left) / layout.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - layout.top) / layout.height) * 100));
    const pt: AnchorPoint = { x, y };

    pushModelHistory();
    model.setModelAnchor(model.activeModelAnchorKey, pt);
  }

  // ─── handleCanvasClick: Load if empty, set anchor if loaded ───────────────

  function handleCanvasClick(e: MouseEvent) {
    if (!model.modelShot) {
      handleLoadWithCheck();
    } else {
      setAnchorAtClick(e);
    }
  }

  // ─── executeSave: Inject metadata and download PNG ────────────────────────

  async function executeSave(): Promise<boolean> {
    const shot = model.modelShot;
    if (!shot) return false;

    ui.setProcessing(true);
    try {
      const buf = await (await (await fetch(shot.url)).blob()).arrayBuffer();
      const meta: Record<string, string> = {
        PicType: 'ModelShot',
        PicX: shot.picX.toString(),
      };

      if (shot.modelSkin) meta['ModelSkin'] = shot.modelSkin;
      if (shot.modelPicId !== undefined) meta['ModelPicId'] = shot.modelPicId.toString();
      if (shot.modelAnchorEarC) meta['ModelAnchorEarC'] = serializeAnchor(shot.modelAnchorEarC);
      if (shot.modelAnchorRingC) meta['ModelAnchorRingC'] = serializeAnchor(shot.modelAnchorRingC);
      if (shot.modelAnchorNecklaceL) meta['ModelAnchorNecklaceL'] = serializeAnchor(shot.modelAnchorNecklaceL);
      if (shot.modelAnchorNecklaceR) meta['ModelAnchorNecklaceR'] = serializeAnchor(shot.modelAnchorNecklaceR);
      if (shot.modelAnchorBraceletL) meta['ModelAnchorBraceletL'] = serializeAnchor(shot.modelAnchorBraceletL);
      if (shot.modelAnchorBraceletR) meta['ModelAnchorBraceletR'] = serializeAnchor(shot.modelAnchorBraceletR);

      // Include product list if multiProducts exist
      const produktList = buildProduktList(products.multiProducts);
      if (produktList) meta['ProduktList'] = produktList;

      const newBuf = PngMetadata.injectMetadata(buf, meta);
      const finalName = `AI_${shot.name.replace('.png', '')}_Model.png`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([newBuf], { type: 'image/png' }));
      link.download = finalName;
      link.click();

      model.markModelClean();
      return true;
    } catch {
      alert('Failed to save metadata.');
      return false;
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── saveImageWithMetadata: Validate then save ────────────────────────────

  async function saveImageWithMetadata(): Promise<boolean> {
    const validation = validateModelShot();
    if (!validation.isValid) {
      ui.openValidation({
        message: validation.message,
        onConfirm: () => {
          ui.closeValidation();
          executeSave();
        },
      });
      return false;
    }
    return executeSave();
  }

  // ─── handleRemoveBackground: AI background removal via Gemini ─────────────

  async function handleRemoveBackground() {
    const shot = model.modelShot;
    if (!shot) return;

    ui.setProcessing(true);
    try {
      let result = await gemini.removeBackground(shot.url);
      if (result) {
        pushModelHistory();
        result = await makeWhiteTransparent(result);
        const dims = await getImageDimensions(result);
        model.setModelShot({ ...shot, url: result });
        model.setModelDims(dims);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('Quota Error (429): API-Key Kontingent erschöpft. Bitte Key wechseln.');
      } else {
        alert('AI Background Removal failed.');
      }
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── handleAiAutoCrop: Auto-crop transparent pixels ───────────────────────

  async function handleAiAutoCrop() {
    const shot = model.modelShot;
    if (!shot) return;

    ui.setProcessing(true);
    try {
      const cropped = await autoCropTransparent(shot.url);
      const dims = await getImageDimensions(cropped);
      pushModelHistory();
      model.setModelShot({ ...shot, url: cropped });
      model.setModelDims(dims);
    } catch {
      alert('AI Crop failed.');
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── goHelp: Switch to help tab ───────────────────────────────────────────

  function goHelp(sectionId?: string) {
    ui.showHelp(sectionId ?? null);
  }

  // ─── setCroppingTarget: Open crop tool ────────────────────────────────────

  function openCropTool() {
    ui.setCroppingTarget('ModelShot');
  }
</script>

<!-- Hidden file input for model image loading -->
<input
  bind:this={fileInputEl}
  type="file"
  accept="image/*"
  class="hidden"
  onchange={handleFileUpload}
/>

<div class="col-span-12 grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
  <!-- ═══════════════════════════════════════════════════════════════════════
       Left Side: Canvas Area
       ═══════════════════════════════════════════════════════════════════════ -->
  <div class="col-span-12 lg:col-span-9 flex flex-col gap-3">
    <!-- Canvas -->
    <div
      bind:this={modelCanvasEl}
      class="w-full h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-220px)] bg-white/[0.02] rounded-[2rem] sm:rounded-[3rem] lg:rounded-[3rem] border border-white/10 flex items-center justify-center relative overflow-hidden shadow-inner cursor-crosshair group"
      onclick={handleCanvasClick}
      role="button"
      tabindex="0"
    >
      <!-- Grid background -->
      <div class="absolute inset-0 bg-grid-white/[0.01] bg-[length:40px_40px]"></div>

      {#if model.modelShot}
        <!-- Model image -->
        <img
          src={model.modelShot.url}
          alt="Model"
          class="max-w-full max-h-full object-contain drop-shadow-2xl z-10 select-none pointer-events-none"
        />

        <!-- Anchor point overlays -->
        {#if modelLayout}
          <div
            class="absolute z-20 pointer-events-none"
            style="width: {modelLayout.width}px; height: {modelLayout.height}px; left: {modelLayout.left}px; top: {modelLayout.top}px;"
          >
            {#each MODEL_ANCHOR_SLOTS as slot}
              {@const anchor = model.modelShot[slot.key]}
              {#if anchor}
                <div
                  class="absolute w-10 h-10 border-[3px] border-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20"
                  style="left: {anchor.x}%; top: {anchor.y}%; background-color: {slot.color}cc;"
                >
                  <span class="text-[9px] font-black text-white">{slot.mode}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {:else}
        <!-- Empty state -->
        <div class="text-center space-y-6">
          <div class="w-24 h-24 bg-indigo-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto ring-1 ring-indigo-500/20 shadow-2xl">
            <Camera class="w-10 h-10 text-indigo-400" />
          </div>
          <p class="text-slate-200 font-black uppercase text-[13px] tracking-[0.4em]">
            Model Canvas Initiation
          </p>
        </div>
      {/if}
    </div>

    <!-- Bottom Buttons -->
    <div class="flex gap-2 sm:gap-3 relative">
      <!-- Undo -->
      {#if history.canUndoModel}
        <button
          onclick={undoModel}
          class="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl active:scale-90 flex-shrink-0"
        >
          <Undo2 class="w-4 h-4" />
        </button>
      {/if}

      <!-- Load Model -->
      <button
        onclick={handleLoadWithCheck}
        class="flex-1 py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-500 rounded-[1.5rem] text-[11px] sm:text-[12px] font-black uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
      >
        <RefreshCcw class="w-4 h-4" />
        <span>Load Model</span>
      </button>

      <!-- Save -->
      {#if model.modelShot}
        <button
          onclick={saveImageWithMetadata}
          class="flex-1 py-3 sm:py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[1.5rem] text-[11px] sm:text-[12px] font-black uppercase tracking-widest text-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Save class="w-4 h-4" />
          <span>Save</span>
        </button>
      {/if}

      <!-- AI Background Remover -->
      {#if model.modelShot}
        <button
          onclick={handleRemoveBackground}
          class="py-3 sm:py-4 px-4 sm:px-6 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-indigo-600/20 active:scale-95"
        >
          <Sparkles class="w-4 h-4" />
          <span class="hidden sm:inline">AI Background Remover</span>
        </button>
      {/if}

      <!-- AI Crop -->
      {#if model.modelShot}
        <button
          onclick={handleAiAutoCrop}
          class="py-3 sm:py-4 px-4 sm:px-6 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-500/20 active:scale-95"
        >
          <Wand2 class="w-4 h-4" />
          <span class="hidden sm:inline">AI Crop</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════
       Right Side: Model Settings Sidebar
       ═══════════════════════════════════════════════════════════════════════ -->
  <div class="col-span-12 lg:col-span-3 space-y-3 sm:space-y-4">
    <div class="p-4 sm:p-5 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Camera class="w-4 h-4 text-indigo-400" />
          <h3 class="text-[12px] font-black uppercase tracking-widest">Model Settings</h3>
        </div>
        <div class="flex items-center gap-1">
          <!-- Help button -->
          <button
            onclick={() => goHelp('help-model')}
            title="Help"
            class="p-2 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
          >
            <MessageSquareText class="w-3.5 h-3.5" />
          </button>
          <!-- Crop button -->
          {#if model.modelShot}
            <button
              onclick={openCropTool}
              class="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400"
            >
              <Scissors class="w-3.5 h-3.5" />
            </button>
          {/if}
        </div>
      </div>

      <!-- Settings content (only when model is loaded) -->
      {#if model.modelShot}
        <div class="space-y-6">
          <!-- Ref. Height (cm) -->
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
              Ref. Height (cm)
            </label>
            <div class="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-2xl border border-white/10">
              <input
                type="number"
                step="0.1"
                value={model.modelShot.picX || ''}
                oninput={(e) => {
                  pushModelHistory();
                  model.updateModelShot({ picX: parseFloat((e.target as HTMLInputElement).value) || 0 });
                }}
                class="bg-transparent text-[15px] font-black text-white w-full outline-none"
                placeholder="0.0"
              />
              <span class="text-[10px] text-slate-600 font-black">CM</span>
            </div>
          </div>

          <!-- Skin Tone -->
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
              Skin Tone
            </label>
            <div class="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-2xl border border-white/10">
              <input
                type="color"
                value={model.modelShot.modelSkin || '#c68642'}
                oninput={(e) => {
                  model.updateModelShot({ modelSkin: (e.target as HTMLInputElement).value });
                }}
                class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
              />
              <input
                type="text"
                value={model.modelShot.modelSkin || ''}
                oninput={(e) => {
                  model.updateModelShot({ modelSkin: (e.target as HTMLInputElement).value });
                }}
                class="bg-transparent text-[13px] font-mono text-white w-full outline-none"
                placeholder="#c68642"
              />
            </div>
          </div>

          <!-- Model ID -->
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
              Model ID
            </label>
            <div class="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-2xl border border-white/10">
              <Hash class="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <input
                type="number"
                value={model.modelShot.modelPicId ?? ''}
                oninput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  model.updateModelShot({
                    modelPicId: val ? parseInt(val) : undefined,
                  });
                }}
                class="bg-transparent text-[15px] font-black text-white w-full outline-none"
                placeholder="—"
              />
            </div>
          </div>

          <!-- Anchor Points -->
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
              Anchor Points
            </label>
            <div class="space-y-1.5 bg-black/40 p-3 rounded-[2rem] border border-white/5">
              {#each MODEL_ANCHOR_SLOTS as slot}
                {@const anchor = model.modelShot[slot.key]}
                {@const isActive = model.activeModelAnchorKey === slot.key}
                <div
                  class="flex items-center gap-3 p-2.5 rounded-2xl transition-all {isActive
                    ? 'bg-indigo-600/10 border border-indigo-500/20'
                    : ''}"
                >
                  <!-- Color dot -->
                  <div
                    class="w-4 h-4 rounded-full flex-shrink-0"
                    style="background-color: {slot.color};"
                  ></div>

                  <!-- Label + coordinates -->
                  <div class="flex-1 min-w-0">
                    <span class="text-[11px] font-black uppercase tracking-widest text-slate-300 block">
                      {slot.label}
                    </span>
                    {#if anchor}
                      <p class="text-[8px] font-mono text-slate-500">
                        X: {anchor.x.toFixed(1)}% Y: {anchor.y.toFixed(1)}%
                      </p>
                    {/if}
                  </div>

                  <!-- Clear button -->
                  {#if anchor}
                    <button
                      onclick={() => {
                        model.clearModelAnchor(slot.key as ModelAnchorKey);
                      }}
                      class="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  {/if}

                  <!-- Activate / set active anchor key -->
                  <button
                    onclick={() => {
                      model.activeModelAnchorKey = slot.key as ModelAnchorKey;
                    }}
                    class="p-2.5 rounded-xl flex-shrink-0 {isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-slate-500 hover:text-white'}"
                  >
                    <Crosshair class="w-4 h-4" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
