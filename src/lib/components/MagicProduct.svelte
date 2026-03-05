<script lang="ts">
  import type { ProductImageState, AnchorPoint, PicForm } from '$lib/types';
  import { getProductsStore } from '$lib/stores/products.svelte';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import { getHistoryStore } from '$lib/stores/history.svelte';
  import { getMatcherStore } from '$lib/stores/matcher.svelte';
  import { FORM_COLOR } from '$lib/stores/model.svelte';
  import {
    getImageDimensions,
    convertToPngUrl,
    parseAnchor,
    serializeAnchor,
    formatEAN,
    autoCropTransparent,
    makeWhiteTransparent,
    getImageLayoutRect,
    FORM_OPTIONS,
    serializeShadow,
    deserializeShadow,
  } from '$lib/utils/snap';
  import { PngMetadata } from '$lib/utils/pngMetadata';
  import { GeminiService } from '$lib/services/gemini';
  import FormSelectModal from '$lib/components/FormSelectModal.svelte';
  import {
    Upload,
    RefreshCcw,
    Save,
    Sparkles,
    Wand2,
    Crop as CropIcon,
    Package,
    Layers,
    Hash,
    MessageSquareText,
    Play,
    Crosshair,
    X,
    Undo2,
    CheckCircle2,
  } from 'lucide-svelte';

  // ── Store instances ──────────────────────────────────────────────────────────
  const products = getProductsStore();
  const ui = getUIStore();
  const history = getHistoryStore();
  const matcher = getMatcherStore();
  const gemini = new GeminiService();

  // ── Local state ──────────────────────────────────────────────────────────────
  let canvasEl: HTMLDivElement | undefined = $state();
  let fileInputEl: HTMLInputElement | undefined = $state();
  let activeAnchorMode = $state<'C' | 'L' | 'R'>('C');
  let showFormSelect = $state(false);
  let pendingFormCallback = $state<((form: PicForm) => void) | null>(null);

  // ── Reactive canvas size (ResizeObserver → $state) ────────────────────────────
  let productCanvasWidth = $state(0);
  let productCanvasHeight = $state(0);

  $effect(() => {
    if (!canvasEl) return;
    productCanvasWidth = canvasEl.clientWidth;
    productCanvasHeight = canvasEl.clientHeight;
    const observer = new ResizeObserver(([entry]) => {
      productCanvasWidth = entry.contentRect.width;
      productCanvasHeight = entry.contentRect.height;
    });
    observer.observe(canvasEl);
    return () => observer.disconnect();
  });

  // ── Derived: product layout for anchor overlay (pure — no side effects) ───────
  let productLayout = $derived.by(() => {
    if (!canvasEl || !products.productShotDims || productCanvasWidth <= 0) return null;
    return getImageLayoutRect(
      productCanvasWidth,
      productCanvasHeight,
      products.productShotDims.width,
      products.productShotDims.height
    );
  });

  // ── Sync productLayout → UI store (side effect belongs in $effect) ─────────
  $effect(() => {
    ui.productLayout = productLayout;
  });

  // ── History helpers ──────────────────────────────────────────────────────────
  function pushHistory() {
    if (products.productShot) {
      history.pushProductState(
        JSON.parse(JSON.stringify(products.productShot)),
        JSON.parse(JSON.stringify(matcher.shadowConfig))
      );
    }
  }

  function undoProduct() {
    const prev = history.undoProduct();
    if (prev) {
      products.setProductShot(prev.shot);
      matcher.setShadowConfig(prev.shadow);
      getImageDimensions(prev.shot.url).then((dims) => products.setProductDims(dims));
    }
  }

  // ── Validate shot for save warnings ──────────────────────────────────────────
  function validateShot(): { isValid: true } | { isValid: false; message: string } {
    const shot = products.productShot;
    if (!shot) return { isValid: true };
    const isDual = shot.picForm === 'Necklace' || shot.picForm === 'Bracelet';
    const hasHeight = isDual ? true : shot.picX > 0;
    const hasAnchor = isDual
      ? shot.productAnchorL !== null || shot.productAnchorR !== null
      : shot.productAnchorC !== null;
    if (!hasHeight || !hasAnchor) {
      const missing: string[] = [];
      if (!hasHeight) missing.push('Real Height (cm)');
      if (!hasAnchor) missing.push('Anchor Point');
      return { isValid: false, message: `Warning: You haven't set ${missing.join(' and ')} yet.` };
    }
    return { isValid: true };
  }

  // ── Load product from file ───────────────────────────────────────────────────
  function handleLoadProduct() {
    fileInputEl?.click();
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    let finalUrl = '';
    const isPngFile = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    if (!isPngFile) {
      const confirmed = window.confirm('Not a PNG. Upload anyway?');
      if (!confirmed) { input.value = ''; return; }
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

    const loadProductData = async (url: string, name: string) => {
      const dims = await getImageDimensions(url);
      let meta: Record<string, string> = {};
      if (isPngFile) {
        try {
          const buf = await (await fetch(url)).arrayBuffer();
          if (PngMetadata.isPng(buf)) meta = PngMetadata.getAllMetadata(buf);
        } catch { console.warn('Metadata extraction skipped'); }
      }

      const eanMatch = name.match(/\d{13}/);
      const initialEAN = eanMatch ? eanMatch[0] : (meta['EAN-Nummer'] || meta['ean-nummer'] || '');
      const shadowStr = meta['PicShadow'] || meta['picshadow'];
      if (shadowStr) matcher.setShadowConfig(deserializeShadow(shadowStr));

      const buildState = (form: PicForm): ProductImageState => ({
        url,
        name,
        picType: 'ProductShot',
        picForm: form,
        picX: parseFloat(meta['PicX'] || meta['picx'] || '0'),
        ean: initialEAN,
        productAnchorC: parseAnchor(meta['ProductAnchorC'] || meta['productanchorc']),
        productAnchorL: parseAnchor(meta['ProductAnchorL'] || meta['productanchorl']),
        productAnchorR: parseAnchor(meta['ProductAnchorR'] || meta['productanchorr']),
      });

      const finalize = (state: ProductImageState) => {
        pushHistory();

        // Auto-add to multiProducts
        const alreadyIn = products.multiProducts.some((p) => p.url === state.url);
        const newIdx = alreadyIn ? products.activeMultiIdx : products.multiProducts.length;
        if (!alreadyIn) {
          const defaultTf = { x: 0.5 + (newIdx % 3) * 0.05, y: 0.4 + (newIdx % 2) * 0.05, scale: 0.35, rotation: 0 };
          matcher.setMultiArrays(
            [...matcher.multiTransforms, defaultTf],
            [...matcher.multiShadows, JSON.parse(JSON.stringify(matcher.shadowConfig))],
            [...matcher.multiHidden, false]
          );
          products.addProduct(state);
        }
        products.activeMultiIdx = newIdx;
        products.setProductShot(state);
        products.setProductDims(dims);
        products.markProductClean();

        // Reset anchor mode based on form
        const isDual = state.picForm === 'Necklace' || state.picForm === 'Bracelet';
        activeAnchorMode = isDual ? 'L' : 'C';
      };

      // If PicForm stored in PNG -> confirm or re-select
      const storedForm = (meta['PicForm'] || meta['picform']) as PicForm | undefined;
      if (storedForm && FORM_OPTIONS.includes(storedForm)) {
        ui.openValidation({
          message: `PNG metadata contains form: "${storedForm}". Keep it?`,
          previewUrl: url,
          confirmLabel: 'Keep',
          cancelLabel: 'Change Form',
          onConfirm: () => {
            ui.closeValidation();
            finalize(buildState(storedForm));
          },
          onCancel: () => {
            ui.closeValidation();
            pendingFormCallback = (form: PicForm) => finalize(buildState(form));
            showFormSelect = true;
          },
        });
      } else {
        pendingFormCallback = (form: PicForm) => finalize(buildState(form));
        showFormSelect = true;
      }
    };

    if (isPngFile) {
      const reader = new FileReader();
      reader.onload = (event) => loadProductData(event.target?.result as string, file.name);
      reader.readAsDataURL(file);
    } else {
      await loadProductData(finalUrl, file.name.replace(/\.[^/.]+$/, '') + '.png');
    }
    input.value = '';
  }

  // ── Form select callback ─────────────────────────────────────────────────────
  function handleFormSelect(form: PicForm) {
    showFormSelect = false;
    pendingFormCallback?.(form);
    pendingFormCallback = null;
  }

  function handleFormCancel() {
    showFormSelect = false;
    pendingFormCallback = null;
  }

  // ── Set anchor at click position ─────────────────────────────────────────────
  function setAnchorAtClick(e: MouseEvent) {
    const shot = products.productShot;
    if (!shot || !canvasEl || !products.productShotDims || productCanvasWidth <= 0) return;

    const layout = getImageLayoutRect(
      productCanvasWidth,   // reactive $state — always up-to-date
      productCanvasHeight,
      products.productShotDims.width,
      products.productShotDims.height
    );
    if (!layout) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - layout.left) / layout.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - layout.top) / layout.height) * 100));
    const pt: AnchorPoint = { x, y };

    pushHistory();
    const field =
      activeAnchorMode === 'C' ? 'productAnchorC' :
      activeAnchorMode === 'L' ? 'productAnchorL' : 'productAnchorR';
    products.updateProductShot({ [field]: pt });
  }

  function handleCanvasClick(e: MouseEvent) {
    if (!products.productShot) {
      handleLoadProduct();
    } else {
      setAnchorAtClick(e);
    }
  }

  // ── Save with PNG metadata ───────────────────────────────────────────────────
  async function executeSave() {
    const shot = products.productShot;
    if (!shot) return false;
    ui.setProcessing(true);
    try {
      const buf = await (await (await fetch(shot.url)).blob()).arrayBuffer();
      const meta: Record<string, string> = {
        PicType: 'ProductShot',
        PicForm: shot.picForm,
        PicX: shot.picX.toString(),
        'EAN-Nummer': shot.ean || '',
        PicShadow: serializeShadow(matcher.shadowConfig),
      };
      if (shot.productAnchorC) meta['ProductAnchorC'] = serializeAnchor(shot.productAnchorC);
      if (shot.productAnchorL) meta['ProductAnchorL'] = serializeAnchor(shot.productAnchorL);
      if (shot.productAnchorR) meta['ProductAnchorR'] = serializeAnchor(shot.productAnchorR);

      const newBuf = PngMetadata.injectMetadata(buf, meta);
      const finalName = `AI_${shot.ean || 'no-ean'}_${shot.picForm}.png`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([newBuf], { type: 'image/png' }));
      link.download = finalName;
      link.click();
      products.markProductClean();
      return true;
    } catch {
      alert('Failed to save metadata.');
      return false;
    } finally {
      ui.setProcessing(false);
    }
  }

  async function handleSave() {
    const validation = validateShot();
    if (!validation.isValid) {
      ui.openValidation({
        message: validation.message,
        onConfirm: () => {
          ui.closeValidation();
          executeSave();
        },
      });
      return;
    }
    await executeSave();
  }

  // ── AI Background Removal ────────────────────────────────────────────────────
  async function handleRemoveBackground() {
    const shot = products.productShot;
    if (!shot) return;
    ui.setProcessing(true);
    try {
      let result = await gemini.removeBackground(shot.url, products.productPrompt);
      if (result) {
        pushHistory();
        result = await makeWhiteTransparent(result);
        const dims = await getImageDimensions(result);
        products.updateProductShot({ url: result });
        products.setProductDims(dims);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert('Quota Error (429): API-Key Kontingent erschoepft. Bitte Key wechseln.');
      } else {
        alert('AI Background Removal failed.');
      }
    } finally {
      ui.setProcessing(false);
    }
  }

  // ── AI Auto-Crop (transparent border trim) ───────────────────────────────────
  async function handleAiAutoCrop() {
    const shot = products.productShot;
    if (!shot) return;
    ui.setProcessing(true);
    try {
      const cropped = await autoCropTransparent(shot.url);
      const dims = await getImageDimensions(cropped);
      pushHistory();
      products.updateProductShot({ url: cropped });
      products.setProductDims(dims);
    } catch {
      alert('AI Crop failed.');
    } finally {
      ui.setProcessing(false);
    }
  }

  // ── Manual Crop (opens cropper) ──────────────────────────────────────────────
  function handleCrop() {
    if (products.productShot) {
      ui.setCroppingTarget('ProductShot');
    }
  }

  // ── Help ─────────────────────────────────────────────────────────────────────
  function goHelp() {
    ui.showHelp('help-product');
  }

  // ── Product list: switch active product ──────────────────────────────────────
  function selectProduct(idx: number) {
    const prod = products.multiProducts[idx];
    if (!prod) return;
    pushHistory();
    products.activeMultiIdx = idx;
    products.setProductShot(prod);
    getImageDimensions(prod.url).then((dims) => products.setProductDims(dims));
    products.markProductClean();
    const isDual = prod.picForm === 'Necklace' || prod.picForm === 'Bracelet';
    activeAnchorMode = isDual ? 'L' : 'C';
  }

  // ── EAN input handler ────────────────────────────────────────────────────────
  function handleEanInput(e: Event) {
    const input = e.target as HTMLInputElement;
    pushHistory();
    products.updateProductShot({ ean: input.value.replace(/\D/g, '').substring(0, 13) });
  }

  // ── Height input handler ─────────────────────────────────────────────────────
  function handleHeightInput(e: Event) {
    const input = e.target as HTMLInputElement;
    pushHistory();
    products.updateProductShot({ picX: parseFloat(input.value) || 0 });
  }

  // ── Clear an anchor ──────────────────────────────────────────────────────────
  function clearAnchor(mode: 'C' | 'L' | 'R') {
    const field =
      mode === 'C' ? 'productAnchorC' :
      mode === 'L' ? 'productAnchorL' : 'productAnchorR';
    products.updateProductShot({ [field]: null });
  }

  // ── Derived helpers ──────────────────────────────────────────────────────────
  let shot = $derived(products.productShot);
  let isDual = $derived(shot ? shot.picForm === 'Necklace' || shot.picForm === 'Bracelet' : false);
</script>

<!-- Hidden file input -->
<input
  bind:this={fileInputEl}
  type="file"
  accept="image/*"
  class="hidden"
  onchange={handleFileUpload}
/>

<!-- Form Select Modal -->
{#if showFormSelect}
  <FormSelectModal onSelect={handleFormSelect} onCancel={handleFormCancel} />
{/if}

<div class="col-span-12 grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">

  <!-- ═══════════════════════════════════════════════════════════════════════════
       LEFT SIDE — Canvas + Bottom Buttons (col-span-9)
  ═══════════════════════════════════════════════════════════════════════════ -->
  <div class="col-span-12 lg:col-span-9 flex flex-col gap-3">

    <!-- Canvas area -->
    <div
      bind:this={canvasEl}
      class="w-full h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-220px)] bg-white/[0.02] rounded-[2rem] sm:rounded-[3rem] lg:rounded-[3rem] border border-white/10 flex items-center justify-center relative overflow-hidden shadow-inner cursor-crosshair group"
      onclick={handleCanvasClick}
      role="button"
      tabindex="0"
    >
      <!-- Grid background -->
      <div class="absolute inset-0 bg-grid-white/[0.01] bg-[length:40px_40px]"></div>

      {#if shot}
        <!-- Product image -->
        <img src={shot.url} class="max-w-full max-h-full object-contain drop-shadow-2xl z-10 select-none pointer-events-none" alt="Product" />

        <!-- Anchor overlay -->
        {#if productLayout}
          <div
            class="absolute z-20 pointer-events-none"
            style="width: {productLayout.width}px; height: {productLayout.height}px; left: {productLayout.left}px; top: {productLayout.top}px;"
          >
            <!-- Center anchor (C) -->
            {#if shot.productAnchorC}
              <div
                class="absolute w-10 h-10 border-[3px] border-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20"
                style="left: {shot.productAnchorC.x}%; top: {shot.productAnchorC.y}%; background-color: {FORM_COLOR[shot.picForm]}cc;"
              >
                <span class="text-[9px] font-black text-white">C</span>
              </div>
            {/if}
            <!-- Left anchor (L) -->
            {#if shot.productAnchorL}
              <div
                class="absolute w-10 h-10 border-[3px] border-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20"
                style="left: {shot.productAnchorL.x}%; top: {shot.productAnchorL.y}%; background-color: #a855f7cc;"
              >
                <span class="text-[9px] font-black text-white">L</span>
              </div>
            {/if}
            <!-- Right anchor (R) -->
            {#if shot.productAnchorR}
              <div
                class="absolute w-10 h-10 border-[3px] border-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20"
                style="left: {shot.productAnchorR.x}%; top: {shot.productAnchorR.y}%; background-color: #ec4899cc;"
              >
                <span class="text-[9px] font-black text-white">R</span>
              </div>
            {/if}
          </div>
        {/if}
      {:else}
        <!-- Empty state placeholder -->
        <div class="text-center space-y-6">
          <div class="w-24 h-24 bg-indigo-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto ring-1 ring-indigo-500/20 shadow-2xl">
            <Upload class="w-10 h-10 text-indigo-400" />
          </div>
          <p class="text-slate-200 font-black uppercase text-[13px] tracking-[0.4em]">Product Optimization</p>
        </div>
      {/if}
    </div>

    <!-- Bottom action buttons -->
    <div class="flex gap-2 sm:gap-3 relative">
      <!-- Undo -->
      {#if history.canUndoProduct}
        <button
          onclick={undoProduct}
          class="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl active:scale-90 flex-shrink-0"
        >
          <Undo2 class="w-4 h-4" />
        </button>
      {/if}

      <!-- Load Product -->
      <button
        onclick={handleLoadProduct}
        class="flex-1 py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-500 rounded-[1.5rem] text-[11px] sm:text-[12px] font-black uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
      >
        <RefreshCcw class="w-4 h-4" />
        <span>Load Product</span>
      </button>

      <!-- Save -->
      {#if shot}
        <button
          onclick={handleSave}
          class="flex-1 py-3 sm:py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[1.5rem] text-[11px] sm:text-[12px] font-black uppercase tracking-widest text-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Save class="w-4 h-4" />
          <span>Save</span>
        </button>
      {/if}

      <!-- AI Background Remover -->
      {#if shot}
        <button
          onclick={handleRemoveBackground}
          class="py-3 sm:py-4 px-4 sm:px-5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-indigo-600/20 active:scale-95"
        >
          <Sparkles class="w-4 h-4" />
          <span class="hidden sm:inline">AI Background Remover</span>
        </button>
      {/if}

      <!-- Crop -->
      {#if shot}
        <button
          onclick={handleCrop}
          class="py-3 sm:py-4 px-4 sm:px-5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-blue-500/20 active:scale-95"
        >
          <CropIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Crop</span>
        </button>
      {/if}

      <!-- AI Crop -->
      {#if shot}
        <button
          onclick={handleAiAutoCrop}
          class="py-3 sm:py-4 px-4 sm:px-5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-500/20 active:scale-95"
        >
          <Wand2 class="w-4 h-4" />
          <span class="hidden sm:inline">AI Crop</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════════
       RIGHT SIDE — Product Sidebar (col-span-3)
  ═══════════════════════════════════════════════════════════════════════════ -->
  <div class="col-span-12 lg:col-span-3 space-y-3 sm:space-y-4">

    <!-- Product list panel -->
    <div class="p-4 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-2">
      <div class="flex items-center gap-2 mb-1">
        <Layers class="w-4 h-4 text-indigo-400" />
        <h3 class="text-[11px] font-black uppercase tracking-widest">Produkte</h3>
        <span class="ml-auto text-[9px] font-black text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-2 py-0.5">
          {products.multiProducts.length}
        </span>
      </div>

      {#if products.multiProducts.length === 0}
        <p class="text-[10px] text-slate-600 font-black uppercase tracking-widest text-center py-3">Noch keine Produkte</p>
      {:else}
        <div class="space-y-1">
          {#each products.multiProducts as prod, idx}
            {@const isActive = products.activeMultiIdx === idx}
            {@const hasAnchor = prod.productAnchorC !== null || prod.productAnchorL !== null || prod.productAnchorR !== null}
            {@const hasHeight = prod.picX > 0}
            {@const isComplete = hasAnchor && (prod.picForm === 'Necklace' || prod.picForm === 'Bracelet' ? hasAnchor : hasHeight && hasAnchor)}
            <button
              onclick={() => selectProduct(idx)}
              class="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all w-full text-left {isActive
                ? 'bg-indigo-600/20 border border-indigo-500/40 shadow-lg shadow-indigo-600/10'
                : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/10'}"
            >
              <div class="relative flex-shrink-0">
                <img
                  src={prod.url}
                  class="w-9 h-9 object-contain rounded-lg bg-white/5 {isComplete ? 'ring-1 ring-green-500/50' : ''}"
                  alt={prod.name}
                />
                {#if isComplete}
                  <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border border-black flex items-center justify-center">
                    <CheckCircle2 class="w-2 h-2 text-white" />
                  </div>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-black truncate {isActive ? 'text-white' : 'text-slate-300'}">
                  {prod.ean ? formatEAN(prod.ean) : prod.name}
                </p>
                <div class="flex items-center gap-1 mt-0.5">
                  <div class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {FORM_COLOR[prod.picForm]}"></div>
                  <p class="text-[8px] text-slate-500 font-bold uppercase">
                    {prod.picForm}{prod.picX > 0 ? ` \u2022 ${prod.picX}cm` : ''}
                  </p>
                </div>
              </div>
              {#if isActive}
                <div class="w-1.5 h-4 rounded-full bg-indigo-400 flex-shrink-0"></div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Asset Specs panel -->
    <div class="p-4 sm:p-5 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Package class="w-4 h-4 text-indigo-400" />
          <h3 class="text-[12px] font-black uppercase tracking-widest">Asset Specs</h3>
        </div>
        <div class="flex items-center gap-1">
          <button
            onclick={goHelp}
            title="Help"
            class="p-2 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-xl text-slate-400 hover:text-indigo-400 transition-all"
          >
            <MessageSquareText class="w-3.5 h-3.5" />
          </button>
          {#if shot}
            <button
              onclick={handleCrop}
              class="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400"
            >
              <CropIcon class="w-3.5 h-3.5" />
            </button>
          {/if}
        </div>
      </div>

      {#if shot}
        <div class="space-y-6">

          <!-- EAN -->
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">EAN-Nummer</label>
            <div class="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-2xl border border-white/10">
              <Hash class="w-4 h-4 text-indigo-400" />
              <input
                type="text"
                value={formatEAN(shot.ean || '')}
                oninput={handleEanInput}
                class="bg-transparent text-[15px] font-black text-white w-full outline-none"
              />
            </div>
          </div>

          <!-- Form + Height -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Form display -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Form</label>
              <div class="flex items-center gap-2 w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3">
                <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {FORM_COLOR[shot.picForm]}"></div>
                <span class="text-[13px] font-black text-slate-400">{shot.picForm}</span>
              </div>
            </div>

            <!-- Real Height (only for Center-mode: Earring/Ring) -->
            {#if shot.picForm === 'Earring' || shot.picForm === 'Ring'}
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Real Height (cm)</label>
                <div class="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-2xl border border-white/10">
                  <input
                    type="number"
                    step="0.1"
                    value={shot.picX || ''}
                    oninput={handleHeightInput}
                    class="bg-transparent text-[15px] font-black text-white w-full outline-none"
                    placeholder="0.0"
                  />
                  <span class="text-[10px] text-slate-600 font-black">CM</span>
                </div>
              </div>
            {/if}
          </div>

          <!-- Anchor Points / Product Calibration -->
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Product Calibration</label>
            <div class="space-y-1.5 bg-black/40 p-3 rounded-[2rem] border border-white/5">

              {#if isDual}
                <!-- Dual mode: Left + Right (Necklace / Bracelet) -->
                {#each (['L', 'R'] as const) as mode}
                  {@const anchor = mode === 'L' ? shot.productAnchorL : shot.productAnchorR}
                  {@const color = mode === 'L' ? '#a855f7' : '#ec4899'}
                  {@const label = mode === 'L' ? 'Left Chain' : 'Right Chain'}
                  {@const isAnchorActive = activeAnchorMode === mode}

                  <div class="flex items-center gap-3 p-2.5 rounded-2xl transition-all {isAnchorActive ? 'bg-indigo-600/10 border border-indigo-500/20' : ''}">
                    <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: {color}"></div>
                    <div class="flex-1 min-w-0">
                      <span class="text-[11px] font-black uppercase tracking-widest text-slate-300 block">{label}</span>
                      {#if anchor}
                        <p class="text-[8px] font-mono text-slate-500">X: {anchor.x.toFixed(1)}% Y: {anchor.y.toFixed(1)}%</p>
                      {/if}
                    </div>
                    {#if anchor}
                      <button
                        onclick={() => clearAnchor(mode)}
                        class="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    {/if}
                    <button
                      onclick={() => { activeAnchorMode = mode; }}
                      class="p-2.5 rounded-xl flex-shrink-0 {isAnchorActive ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500'}"
                    >
                      <Crosshair class="w-4 h-4" />
                    </button>
                  </div>
                {/each}
              {:else}
                <!-- Center mode (Earring / Ring) -->
                {@const isAnchorActive = activeAnchorMode === 'C'}
                <div class="flex items-center gap-3 p-2.5 rounded-2xl transition-all {isAnchorActive ? 'bg-indigo-600/10 border border-indigo-500/20' : ''}">
                  <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: {FORM_COLOR[shot.picForm]}"></div>
                  <div class="flex-1 min-w-0">
                    <span class="text-[11px] font-black uppercase tracking-widest text-slate-300 block">Center Point</span>
                    {#if shot.productAnchorC}
                      <p class="text-[8px] font-mono text-slate-500">X: {shot.productAnchorC.x.toFixed(1)}% Y: {shot.productAnchorC.y.toFixed(1)}%</p>
                    {/if}
                  </div>
                  {#if shot.productAnchorC}
                    <button
                      onclick={() => clearAnchor('C')}
                      class="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  {/if}
                  <button
                    onclick={() => { activeAnchorMode = 'C'; }}
                    class="p-2.5 rounded-xl flex-shrink-0 {isAnchorActive ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500'}"
                  >
                    <Crosshair class="w-4 h-4" />
                  </button>
                </div>
              {/if}

            </div>
          </div>

          <!-- AI Vision Prompt -->
          <div class="space-y-2 pt-2 border-t border-white/5">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <MessageSquareText class="w-3.5 h-3.5" /> AI Vision Prompt
            </label>
            <div class="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-4">
              <textarea
                bind:value={products.productPrompt}
                class="w-full h-24 bg-transparent text-[11px] font-bold text-slate-300 outline-none resize-none"
                placeholder="Extraction prompt..."
              ></textarea>
              <button
                onclick={handleRemoveBackground}
                class="w-full py-3.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 group"
              >
                <Play class="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110" />
                <span class="text-[10px] font-black uppercase tracking-widest text-indigo-400">Execute AI Extraction</span>
              </button>
            </div>
          </div>

        </div>
      {/if}
    </div>
  </div>
</div>
