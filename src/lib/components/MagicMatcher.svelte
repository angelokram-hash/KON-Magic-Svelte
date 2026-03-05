<script lang="ts">
  import { getModelStore, FORM_COLOR } from '$lib/stores/model.svelte';
  import { getProductsStore, DEFAULT_SHADOW } from '$lib/stores/products.svelte';
  import { getMatcherStore } from '$lib/stores/matcher.svelte';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import {
    computeSnap, getMultiModelBounds, getImageDimensions,
    serializeAnchor, buildProduktList,
    UI_BASE_WIDTH, formatEAN, convertToPngUrl, parseAnchor, deserializeShadow
  } from '$lib/utils/snap';
  import { PngMetadata } from '$lib/utils/pngMetadata';
  import { buildPsd, canvasToRgba, imageUrlToRgba } from '$lib/utils/psdWriter';
  import TransformControls from '$lib/components/TransformControls.svelte';
  import {
    Crosshair, PlusCircle, Download, Layers, Trash2,
    Eye, EyeOff, Zap, Save, CheckCircle2, MessageSquareText,
    ZoomIn, ZoomOut
  } from 'lucide-svelte';
  import type { ProductImageState, PicForm, TransformState, ShadowConfig } from '$lib/types';

  const model = getModelStore();
  const products = getProductsStore();
  const matcher = getMatcherStore();
  const ui = getUIStore();

  // ─── Refs ───────────────────────────────────────────────────────────────────
  let multiContainerEl: HTMLDivElement | undefined = $state();
  let multiProductFileInputEl: HTMLInputElement | undefined = $state();

  // ─── Container Size Tracking ────────────────────────────────────────────────
  let containerSize = $state({ width: 0, height: 0 });

  $effect(() => {
    if (!multiContainerEl) return;
    const update = () => {
      if (multiContainerEl) {
        containerSize = {
          width: multiContainerEl.clientWidth,
          height: multiContainerEl.clientHeight,
        };
        matcher.multiContainerSize = containerSize;
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(multiContainerEl);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  });

  // ─── Derived Model Bounds ───────────────────────────────────────────────────
  function getMultiBounds() {
    if (!model.modelShotDims || containerSize.width <= 0 || containerSize.height <= 0) return null;
    return getMultiModelBounds(containerSize.width, containerSize.height, model.modelShotDims);
  }

  // ─── Shadow filter CSS ──────────────────────────────────────────────────────
  function buildShadowFilter(sc: ShadowConfig, visW: number): string {
    if (!sc.enabled) return 'none';
    const s = sc.size || 1.0;
    const blurPx = (sc.blur / 100) * visW * s;
    const xPx = (sc.x / 100) * visW * s;
    const yPx = (sc.y / 100) * visW * s;
    const r = parseInt(sc.color.slice(1, 3), 16);
    const g = parseInt(sc.color.slice(3, 5), 16);
    const b = parseInt(sc.color.slice(5, 7), 16);
    return `drop-shadow(${xPx}px ${yPx}px ${blurPx}px rgba(${r},${g},${b},${sc.opacity}))`;
  }

  // ─── Metadata builder ───────────────────────────────────────────────────────
  function buildModelMeta(): Record<string, string> {
    const ms = model.modelShot;
    if (!ms) return {};
    const meta: Record<string, string> = { PicType: 'ModelShot', PicX: ms.picX.toString() };
    if (ms.modelSkin) meta['ModelSkin'] = ms.modelSkin;
    if (ms.modelPicId !== undefined) meta['ModelPicId'] = ms.modelPicId.toString();
    if (ms.modelAnchorEarC) meta['ModelAnchorEarC'] = serializeAnchor(ms.modelAnchorEarC);
    if (ms.modelAnchorRingC) meta['ModelAnchorRingC'] = serializeAnchor(ms.modelAnchorRingC);
    if (ms.modelAnchorNecklaceL) meta['ModelAnchorNecklaceL'] = serializeAnchor(ms.modelAnchorNecklaceL);
    if (ms.modelAnchorNecklaceR) meta['ModelAnchorNecklaceR'] = serializeAnchor(ms.modelAnchorNecklaceR);
    if (ms.modelAnchorBraceletL) meta['ModelAnchorBraceletL'] = serializeAnchor(ms.modelAnchorBraceletL);
    if (ms.modelAnchorBraceletR) meta['ModelAnchorBraceletR'] = serializeAnchor(ms.modelAnchorBraceletR);
    return meta;
  }

  // ─── File Input Handler ─────────────────────────────────────────────────────
  async function handleMultiProductFile(e: Event) {
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

    const url = finalUrl || await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = (ev) => res(ev.target?.result as string);
      reader.readAsDataURL(file);
    });

    const dims = await getImageDimensions(url);
    let meta: Record<string, string> = {};
    if (isPngFile) {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        if (PngMetadata.isPng(buf)) meta = PngMetadata.getAllMetadata(buf);
      } catch { /* skip */ }
    }

    const eanMatch = file.name.match(/\d{13}/);
    const initialEAN = eanMatch ? eanMatch[0] : (meta['EAN-Nummer'] || meta['ean-nummer'] || '');
    const shadowStr = meta['PicShadow'] || meta['picshadow'];

    const buildState = (form: PicForm): ProductImageState => ({
      url, name: file.name, picType: 'ProductShot',
      picForm: form,
      picX: parseFloat(meta['PicX'] || meta['picx'] || '0'),
      ean: initialEAN,
      productAnchorC: parseAnchor(meta['ProductAnchorC'] || meta['productanchorc']),
      productAnchorL: parseAnchor(meta['ProductAnchorL'] || meta['productanchorl']),
      productAnchorR: parseAnchor(meta['ProductAnchorR'] || meta['productanchorr']),
    });

    const finalize = (state: ProductImageState) => {
      const newIdx = products.multiProducts.length;
      const defaultTf: TransformState = {
        x: 0.5 + (newIdx % 3) * 0.05,
        y: 0.4 + (newIdx % 2) * 0.05,
        scale: 0.35,
        rotation: 0,
      };
      const shadow = shadowStr ? deserializeShadow(shadowStr) : { ...DEFAULT_SHADOW };
      matcher.addMultiEntry();
      matcher.setMultiTransform(newIdx, defaultTf);
      matcher.setMultiShadow(newIdx, shadow);
      products.addProduct(state);
      products.activeMultiIdx = newIdx;

      // Auto-snap if we can
      autoSnapProduct(newIdx, state);
    };

    const storedForm = (meta['PicForm'] || meta['picform']) as PicForm | undefined;
    if (storedForm && ['Earring', 'Ring', 'Necklace', 'Bracelet'].includes(storedForm)) {
      ui.openValidation({
        message: `PNG metadata contains form: "${storedForm}". Keep it?`,
        previewUrl: url,
        confirmLabel: 'Keep',
        cancelLabel: 'Change Form',
        onConfirm: () => { ui.closeValidation(); finalize(buildState(storedForm)); },
        onCancel: () => {
          ui.closeValidation();
          ui.openFormSelect((form: PicForm) => finalize(buildState(form)));
        },
      });
    } else {
      ui.openFormSelect((form: PicForm) => finalize(buildState(form)));
    }

    input.value = '';
  }

  // ─── Auto-snap a product ────────────────────────────────────────────────────
  async function autoSnapProduct(idx: number, prod: ProductImageState) {
    if (!model.modelShot || !model.modelShotDims) return;
    const mb = getMultiBounds();
    if (!mb) return;
    const prodDims = await getImageDimensions(prod.url);
    const snapped = computeSnap(model.modelShot, model.modelShotDims, prod, prodDims, {
      renderedW: mb.renderedW, renderedH: mb.renderedH,
      offsetX: mb.offsetX, offsetY: mb.offsetY,
    });
    if (snapped) {
      const fracX = snapped.x / mb.cw;
      const fracY = snapped.y / mb.ch;
      matcher.setMultiTransform(idx, { ...snapped, x: fracX, y: fracY });
    }
  }

  // ─── Drag handling ──────────────────────────────────────────────────────────
  function handleCanvasMouseMove(e: MouseEvent) {
    if (matcher.multiDragIdx === null || !multiContainerEl) return;
    const rect = multiContainerEl.getBoundingClientRect();
    const idx = matcher.multiDragIdx;
    const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.5, scale: 0.5, rotation: 0 };
    matcher.setMultiTransform(idx, {
      ...tf,
      x: (e.clientX - rect.left - matcher.multiDragStart.x) / rect.width,
      y: (e.clientY - rect.top - matcher.multiDragStart.y) / rect.height,
    });
  }

  function handleCanvasMouseUp() {
    matcher.multiDragIdx = null;
  }

  function handleProductMouseDown(e: MouseEvent, idx: number) {
    e.stopPropagation();
    if (!multiContainerEl) return;
    const rect = multiContainerEl.getBoundingClientRect();
    const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.3, rotation: 0 };
    products.activeMultiIdx = idx;
    matcher.multiDragIdx = idx;
    matcher.multiDragStart = {
      x: e.clientX - rect.left - tf.x * rect.width,
      y: e.clientY - rect.top - tf.y * rect.height,
    };
  }

  // ─── Touch drag handling ────────────────────────────────────────────────────
  function handleProductTouchStart(e: TouchEvent, idx: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!multiContainerEl) return;
    const rect = multiContainerEl.getBoundingClientRect();
    const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.3, rotation: 0 };
    products.activeMultiIdx = idx;
    matcher.multiDragIdx = idx;
    matcher.multiDragStart = {
      x: e.touches[0].clientX - rect.left - tf.x * rect.width,
      y: e.touches[0].clientY - rect.top - tf.y * rect.height,
    };
  }

  function handleCanvasTouchMove(e: TouchEvent) {
    if (matcher.multiDragIdx === null || !multiContainerEl) return;
    e.preventDefault();
    const rect = multiContainerEl.getBoundingClientRect();
    const idx = matcher.multiDragIdx;
    const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.5, scale: 0.5, rotation: 0 };
    matcher.setMultiTransform(idx, {
      ...tf,
      x: (e.touches[0].clientX - rect.left - matcher.multiDragStart.x) / rect.width,
      y: (e.touches[0].clientY - rect.top - matcher.multiDragStart.y) / rect.height,
    });
  }

  // ─── Snap single product ────────────────────────────────────────────────────
  async function handleSnapProduct(idx: number) {
    const prod = products.multiProducts[idx];
    if (!prod || !model.modelShot || !model.modelShotDims) return;
    products.activeMultiIdx = idx;
    const prodDims = await getImageDimensions(prod.url);
    const mb = getMultiBounds();
    if (!mb) return;
    const snapped = computeSnap(model.modelShot, model.modelShotDims, prod, prodDims, {
      renderedW: mb.renderedW, renderedH: mb.renderedH,
      offsetX: mb.offsetX, offsetY: mb.offsetY,
    });
    if (snapped) {
      const fracX = snapped.x / mb.cw;
      const fracY = snapped.y / mb.ch;
      matcher.setMultiTransform(idx, { ...snapped, x: fracX, y: fracY });
    }
  }

  // ─── Remove product ─────────────────────────────────────────────────────────
  function handleRemoveProduct(idx: number) {
    products.removeProduct(idx);
    matcher.removeMultiEntry(idx);
    if (products.activeMultiIdx > idx) {
      products.activeMultiIdx = Math.max(0, products.activeMultiIdx - 1);
    } else if (products.activeMultiIdx >= products.multiProducts.length) {
      products.activeMultiIdx = Math.max(0, products.multiProducts.length - 1);
    }
  }

  // ─── Export Separate ────────────────────────────────────────────────────────
  async function handleExportSeparate() {
    if (!model.modelShot || !model.modelShotDims) return;
    ui.setProcessing(true);
    try {
      const mb = getMultiBounds();
      if (!mb) return;
      for (let idx = 0; idx < products.multiProducts.length; idx++) {
        const prod = products.multiProducts[idx];
        const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.35, rotation: 0 };
        const prodDims = await getImageDimensions(prod.url);

        const canvas = document.createElement('canvas');
        canvas.width = model.modelShotDims.width;
        canvas.height = model.modelShotDims.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        const modelImg = new Image();
        modelImg.src = model.modelShot.url;
        const productImg = new Image();
        productImg.src = prod.url;
        await Promise.all([
          new Promise(r => { modelImg.onload = r; }),
          new Promise(r => { productImg.onload = r; }),
        ]);

        ctx.drawImage(modelImg, 0, 0, canvas.width, canvas.height);

        const pxX = tf.x * mb.cw;
        const pxY = tf.y * mb.ch;
        const relX = (pxX - mb.offsetX) / mb.renderedW;
        const relY = (pxY - mb.offsetY) / mb.renderedH;
        const visW = (UI_BASE_WIDTH * tf.scale / mb.renderedW) * model.modelShotDims.width;
        const visH = (visW * prodDims.height) / prodDims.width;
        const sc = matcher.multiShadows[idx] ?? DEFAULT_SHADOW;

        ctx.save();
        ctx.translate(relX * model.modelShotDims.width, relY * model.modelShotDims.height);
        ctx.rotate((tf.rotation * Math.PI) / 180);
        if (sc.enabled) {
          ctx.shadowColor = sc.color;
          ctx.shadowBlur = (sc.blur / 100) * visW * (sc.size || 1);
          ctx.shadowOffsetX = (sc.x / 100) * visW * (sc.size || 1);
          ctx.shadowOffsetY = (sc.y / 100) * visW * (sc.size || 1);
        }
        ctx.drawImage(productImg, -visW / 2, -visH / 2, visW, visH);
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/png');
        const res = await fetch(dataUrl);
        let buf = await res.arrayBuffer();

        const meta = buildModelMeta();
        const produktList = buildProduktList(products.multiProducts);
        if (produktList) meta['ProduktList'] = produktList;
        buf = PngMetadata.injectMetadata(buf, meta);

        const picId = model.modelShot.modelPicId?.toString() || 'no-id';
        const formPrefix: Record<string, string> = { Earring: 'E', Ring: 'R', Bracelet: 'B', Necklace: 'N' };
        const sepFileName = `AI_${picId}_${formPrefix[prod.picForm] || '?'}_${prod.ean || `no-ean-${idx + 1}`}.png`;

        const link = document.createElement('a');
        link.download = sepFileName;
        link.href = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
        link.click();
        await new Promise(r => setTimeout(r, 200));
      }
    } catch {
      alert('Export failed.');
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── Export All (composite) ─────────────────────────────────────────────────
  async function handleExportAll() {
    if (!model.modelShot || !model.modelShotDims) return;
    ui.setProcessing(true);
    try {
      const mb = getMultiBounds();
      if (!mb) return;

      const canvas = document.createElement('canvas');
      canvas.width = model.modelShotDims.width;
      canvas.height = model.modelShotDims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const modelImg = new Image();
      modelImg.src = model.modelShot.url;
      await new Promise(r => { modelImg.onload = r; });
      ctx.drawImage(modelImg, 0, 0, canvas.width, canvas.height);

      for (let idx = 0; idx < products.multiProducts.length; idx++) {
        if (matcher.multiHidden[idx]) continue;
        const prod = products.multiProducts[idx];
        const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.35, rotation: 0 };
        const prodDims = await getImageDimensions(prod.url);
        const productImg = new Image();
        productImg.src = prod.url;
        await new Promise(r => { productImg.onload = r; });

        const pxX = tf.x * mb.cw;
        const pxY = tf.y * mb.ch;
        const relX = (pxX - mb.offsetX) / mb.renderedW;
        const relY = (pxY - mb.offsetY) / mb.renderedH;
        const visW = (UI_BASE_WIDTH * tf.scale / mb.renderedW) * model.modelShotDims.width;
        const visH = (visW * prodDims.height) / prodDims.width;
        const sc = matcher.multiShadows[idx] ?? DEFAULT_SHADOW;

        ctx.save();
        ctx.translate(relX * model.modelShotDims.width, relY * model.modelShotDims.height);
        ctx.rotate((tf.rotation * Math.PI) / 180);
        if (sc.enabled) {
          ctx.shadowColor = sc.color;
          ctx.shadowBlur = (sc.blur / 100) * visW * (sc.size || 1);
          ctx.shadowOffsetX = (sc.x / 100) * visW * (sc.size || 1);
          ctx.shadowOffsetY = (sc.y / 100) * visW * (sc.size || 1);
        }
        ctx.drawImage(productImg, -visW / 2, -visH / 2, visW, visH);
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      let buf = await res.arrayBuffer();

      const meta = buildModelMeta();
      const visibleProducts = products.multiProducts.filter((_, i) => !matcher.multiHidden[i]);
      const produktList = buildProduktList(visibleProducts);
      if (produktList) meta['ProduktList'] = produktList;
      buf = PngMetadata.injectMetadata(buf, meta);

      const picId = model.modelShot.modelPicId?.toString() || 'no-id';
      const listCompact = produktList.replace(/ /g, '_');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
      link.download = `AI_${picId}_${listCompact}.png`;
      link.click();
    } catch {
      alert('Export All Neu failed.');
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── Export PSD ─────────────────────────────────────────────────────────────
  async function handleExportPsd() {
    if (!model.modelShot || !model.modelShotDims) return;
    ui.setProcessing(true);
    try {
      const docW = model.modelShotDims.width;
      const docH = model.modelShotDims.height;
      const mb = getMultiBounds();
      if (!mb) return;

      // Layer 1 (bottom): Model Shot -- full document size
      const modelRgba = await imageUrlToRgba(model.modelShot.url, docW, docH);
      const psdLayers = [{
        name: 'Model',
        pixels: modelRgba,
        width: docW,
        height: docH,
        top: 0,
        left: 0,
      }];

      // Layers 2...n: each visible product on its own layer
      for (let idx = 0; idx < products.multiProducts.length; idx++) {
        if (matcher.multiHidden[idx]) continue;
        const prod = products.multiProducts[idx];
        const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.35, rotation: 0 };
        const sc = matcher.multiShadows[idx] ?? DEFAULT_SHADOW;
        const prodDims = await getImageDimensions(prod.url);

        const pxX = tf.x * mb.cw;
        const pxY = tf.y * mb.ch;
        const relX = (pxX - mb.offsetX) / mb.renderedW;
        const relY = (pxY - mb.offsetY) / mb.renderedH;
        const drawX = relX * docW;
        const drawY = relY * docH;
        const visW = (UI_BASE_WIDTH * tf.scale / mb.renderedW) * docW;
        const visH = (visW * prodDims.height) / prodDims.width;

        const productImg = new Image();
        productImg.crossOrigin = 'anonymous';
        productImg.src = prod.url;
        await new Promise<void>(r => { productImg.onload = () => r(); });

        const layerPixels = await canvasToRgba(
          productImg, visW, visH, drawX, drawY, docW, docH, tf.rotation, sc,
        );

        const formPrefix: Record<string, string> = { Earring: 'E', Ring: 'R', Bracelet: 'B', Necklace: 'N' };
        const layerName = `${formPrefix[prod.picForm] || '?'}_${prod.ean || `prod-${idx + 1}`}`;

        psdLayers.push({
          name: layerName,
          pixels: layerPixels,
          width: docW,
          height: docH,
          top: 0,
          left: 0,
        });
      }

      // Build PSD -- layers stored bottom-to-top, so we reverse
      const psdBytes = buildPsd(docW, docH, [...psdLayers].reverse());

      const picId = model.modelShot.modelPicId?.toString() || 'no-id';
      const listStr = buildProduktList(
        products.multiProducts.filter((_, i) => !matcher.multiHidden[i])
      ).replace(/ /g, '_');
      const fileName = `AI_${picId}_${listStr}.psd`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([psdBytes], { type: 'image/vnd.adobe.photoshop' }));
      link.download = fileName;
      link.click();
    } catch (e) {
      console.error('PSD export error:', e);
      alert('PSD Export failed.');
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── Save single product composite ──────────────────────────────────────────
  async function handleSaveSingle(idx: number) {
    const prod = products.multiProducts[idx];
    if (!prod || !model.modelShot || !model.modelShotDims) return;
    ui.setProcessing(true);
    try {
      const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.35, rotation: 0 };
      const sc = matcher.multiShadows[idx] ?? DEFAULT_SHADOW;
      const prodDims = await getImageDimensions(prod.url);
      const mb = getMultiBounds();
      if (!mb) return;

      const canvas = document.createElement('canvas');
      canvas.width = model.modelShotDims.width;
      canvas.height = model.modelShotDims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const mImg = new Image();
      mImg.src = model.modelShot.url;
      const pImg = new Image();
      pImg.src = prod.url;
      await Promise.all([
        new Promise(r => { mImg.onload = r; }),
        new Promise(r => { pImg.onload = r; }),
      ]);

      ctx.drawImage(mImg, 0, 0, canvas.width, canvas.height);
      const pxX = tf.x * mb.cw;
      const pxY = tf.y * mb.ch;
      const relX = (pxX - mb.offsetX) / mb.renderedW;
      const relY = (pxY - mb.offsetY) / mb.renderedH;
      const visW = (UI_BASE_WIDTH * tf.scale / mb.renderedW) * model.modelShotDims.width;
      const visH = (visW * prodDims.height) / prodDims.width;

      ctx.save();
      ctx.translate(relX * model.modelShotDims.width, relY * model.modelShotDims.height);
      ctx.rotate((tf.rotation * Math.PI) / 180);
      if (sc.enabled) {
        ctx.shadowColor = sc.color;
        ctx.shadowBlur = (sc.blur / 100) * visW * (sc.size || 1);
        ctx.shadowOffsetX = (sc.x / 100) * visW * (sc.size || 1);
        ctx.shadowOffsetY = (sc.y / 100) * visW * (sc.size || 1);
      }
      ctx.drawImage(pImg, -visW / 2, -visH / 2, visW, visH);
      ctx.restore();

      const link = document.createElement('a');
      link.download = `${prod.ean || 'no-ean'}_${model.modelShot.name.replace('.png', '')}_AI.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      ui.setProcessing(false);
    }
  }

  // ─── Zoom ───────────────────────────────────────────────────────────────────
  function toggleZoom() {
    matcher.matcherZoomed = !matcher.matcherZoomed;
  }
</script>

<!-- Hidden file input for adding products -->
<input
  bind:this={multiProductFileInputEl}
  type="file"
  accept="image/*"
  class="hidden"
  onchange={handleMultiProductFile}
/>

<div class="col-span-12 grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
  <!-- ══════════════════════════════════════════════════════════════════════════
       LEFT: Canvas Area (col-span-9)
  ══════════════════════════════════════════════════════════════════════════ -->
  <div class="col-span-12 lg:col-span-9 flex flex-col gap-3">
    <!-- Anchor toggle + Zoom controls above canvas -->
    {#if products.multiProducts.length > 0}
      <div class="w-full flex justify-end gap-2">
        <button
          onclick={toggleZoom}
          title={matcher.matcherZoomed ? 'Zoom out' : 'Zoom in'}
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all
            {matcher.matcherZoomed
              ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
              : 'bg-white/5 text-slate-500 border-white/10 hover:text-white hover:bg-white/10'}"
        >
          {#if matcher.matcherZoomed}
            <ZoomOut class="w-3 h-3" />
          {:else}
            <ZoomIn class="w-3 h-3" />
          {/if}
          <span>Zoom</span>
        </button>
        <button
          onclick={() => matcher.showMultiAnchors = !matcher.showMultiAnchors}
          title={matcher.showMultiAnchors ? 'Hide anchors' : 'Show anchors'}
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all
            {matcher.showMultiAnchors
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-white/5 text-slate-500 border-white/10 hover:text-white hover:bg-white/10'}"
        >
          <Crosshair class="w-3 h-3" /><span>Anchors</span>
        </button>
      </div>
    {/if}

    <!-- Main Canvas -->
    <div
      bind:this={multiContainerEl}
      class="relative w-full rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 bg-black touch-none select-none {matcher.matcherZoomed ? '' : 'h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-220px)]'}"
      style={matcher.matcherZoomed ? `height: calc(100vh * ${matcher.matcherZoomFactor});` : ''}
      onmousemove={handleCanvasMouseMove}
      onmouseup={handleCanvasMouseUp}
      onmouseleave={handleCanvasMouseUp}
      ontouchmove={handleCanvasTouchMove}
      ontouchend={handleCanvasMouseUp}
      role="presentation"
    >
      {#if model.modelShot}
        <img
          src={model.modelShot.url}
          alt="Model"
          class="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {#each products.multiProducts as prod, idx}
          {#if !matcher.multiHidden[idx]}
            {@const tf = matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.3, rotation: 0 }}
            {@const cw = containerSize.width || 800}
            {@const ch = containerSize.height || 600}
            {@const cx = tf.x * cw}
            {@const cy = tf.y * ch}
            {@const isActive = products.activeMultiIdx === idx}
            {@const isDraggingThis = matcher.multiDragIdx === idx}
            {@const visW = UI_BASE_WIDTH * tf.scale}
            {@const sc = matcher.multiShadows[idx] ?? DEFAULT_SHADOW}
            {@const shadowFilter = buildShadowFilter(sc, visW)}

            <div
              class="absolute cursor-move {isDraggingThis ? 'z-50' : isActive ? 'z-20' : 'z-10'}"
              style="left: {cx}px; top: {cy}px; width: {visW}px; transform: translate(-50%,-50%) rotate({tf.rotation}deg);"
              onmousedown={(e) => handleProductMouseDown(e, idx)}
              ontouchstart={(e) => handleProductTouchStart(e, idx)}
              role="presentation"
            >
              <div class="relative w-full {isDraggingThis ? 'ring-2 ring-indigo-500 rounded-lg' : isActive ? 'ring-1 ring-white/40 rounded-lg' : ''}">
                <img
                  src={prod.url}
                  alt={prod.name}
                  style="filter: {shadowFilter};"
                  class="w-full h-auto pointer-events-none block"
                />

                <!-- Anchor dots -->
                {#if matcher.showMultiAnchors}
                  {#if prod.productAnchorC}
                    <div
                      class="absolute w-5 h-5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-30"
                      style="left: {prod.productAnchorC.x}%; top: {prod.productAnchorC.y}%; background-color: {FORM_COLOR[prod.picForm]}cc;"
                    >
                      <span class="text-[7px] font-black text-white">C</span>
                    </div>
                  {/if}
                  {#if prod.productAnchorL}
                    <div
                      class="absolute w-5 h-5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-30"
                      style="left: {prod.productAnchorL.x}%; top: {prod.productAnchorL.y}%; background-color: #a855f7cc;"
                    >
                      <span class="text-[7px] font-black text-white">L</span>
                    </div>
                  {/if}
                  {#if prod.productAnchorR}
                    <div
                      class="absolute w-5 h-5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-30"
                      style="left: {prod.productAnchorR.x}%; top: {prod.productAnchorR.y}%; background-color: #ec4899cc;"
                    >
                      <span class="text-[7px] font-black text-white">R</span>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      {:else}
        <div class="absolute inset-0 flex items-center justify-center">
          <p class="text-slate-600 font-black uppercase text-[11px] tracking-widest">Model required</p>
        </div>
      {/if}
    </div>

    <!-- Bottom Action Buttons -->
    <div class="flex flex-wrap gap-2 sm:gap-3">
      <button
        onclick={() => multiProductFileInputEl?.click()}
        class="flex-1 min-w-[130px] py-3 sm:py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[1.5rem] flex items-center justify-center gap-2 transition-all active:scale-95 text-[11px] sm:text-[12px] font-black uppercase tracking-widest"
      >
        <PlusCircle class="w-4 h-4 text-indigo-400" /><span>Add Product</span>
      </button>

      {#if products.multiProducts.length > 0 && model.modelShot}
        <button
          onclick={handleExportSeparate}
          disabled={ui.isProcessing}
          class="flex-1 min-w-[130px] py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-500 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white text-[11px] sm:text-[12px] font-black uppercase tracking-widest disabled:opacity-50"
        >
          <Download class="w-4 h-4" /><span>Export Separat ({products.multiProducts.length})</span>
        </button>

        <button
          onclick={handleExportAll}
          disabled={ui.isProcessing}
          class="flex-1 min-w-[130px] py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-500 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white text-[11px] sm:text-[12px] font-black uppercase tracking-widest disabled:opacity-50"
        >
          <Download class="w-4 h-4" /><span>Export All Neu</span>
        </button>

        <button
          onclick={handleExportPsd}
          disabled={ui.isProcessing}
          class="flex-1 min-w-[130px] py-3 sm:py-4 bg-purple-600 hover:bg-purple-500 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-white text-[11px] sm:text-[12px] font-black uppercase tracking-widest disabled:opacity-50"
        >
          <Layers class="w-4 h-4" /><span>Export PSD</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       RIGHT: Product List & Controls (col-span-3)
  ══════════════════════════════════════════════════════════════════════════ -->
  <div class="col-span-12 lg:col-span-3 space-y-3 sm:space-y-4">
    <div class="p-4 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <!-- Header -->
      <div class="flex items-center gap-2">
        <Layers class="w-4 h-4 text-indigo-400" />
        <h3 class="text-[12px] font-black uppercase tracking-widest">Products</h3>
        {#if products.multiProducts.length > 0}
          <span class="text-[9px] font-black text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-2 py-0.5">
            {products.multiProducts.length}
          </span>
        {/if}
        <button
          onclick={() => ui.showHelp('help-matcher')}
          title="Help"
          class="ml-auto p-1.5 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
        >
          <MessageSquareText class="w-3 h-3" />
        </button>
      </div>

      <!-- Empty state -->
      {#if products.multiProducts.length === 0}
        <div class="text-center py-6 text-slate-600 text-[10px] font-black uppercase tracking-widest">
          No products yet
        </div>
      {:else}
        <!-- Product list -->
        <div class="space-y-1.5">
          {#each products.multiProducts as prod, idx}
            {@const isHidden = matcher.multiHidden[idx] ?? false}
            {@const hasAnchor = prod.productAnchorC !== null || prod.productAnchorL !== null || prod.productAnchorR !== null}
            {@const hasHeight = prod.picX > 0}
            {@const isComplete = hasAnchor && (prod.picForm === 'Necklace' || prod.picForm === 'Bracelet' ? hasAnchor : hasHeight && hasAnchor)}

            <div class="rounded-2xl border transition-all
              {products.activeMultiIdx === idx
                ? 'bg-indigo-600/15 border-indigo-500/35 shadow-md shadow-indigo-600/10'
                : 'bg-white/3 border-white/5'}
              {isHidden ? 'opacity-40' : ''}"
            >
              <!-- Product row (clickable to select) -->
              <div
                class="flex items-center gap-2 p-2 cursor-pointer"
                onclick={() => products.activeMultiIdx = idx}
                role="button"
                tabindex="0"
              >
                <div class="relative flex-shrink-0">
                  <img
                    src={prod.url}
                    alt={prod.name}
                    class="w-8 h-8 object-contain rounded-lg bg-white/5 {isComplete ? 'ring-1 ring-green-500/50' : ''}"
                  />
                  {#if isComplete}
                    <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border border-black flex items-center justify-center">
                      <CheckCircle2 class="w-2 h-2 text-white" />
                    </div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-black text-white truncate">
                    {prod.ean ? formatEAN(prod.ean) : prod.name}
                  </p>
                  <div class="flex items-center gap-1">
                    <div
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      style="background-color: {FORM_COLOR[prod.picForm]};"
                    ></div>
                    <p class="text-[8px] text-slate-500 font-bold uppercase">
                      {prod.picForm} &bull; {prod.picX > 0 ? `${prod.picX}cm` : '\u2014'}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Action buttons row -->
              <div class="flex items-center gap-1 px-2 pb-2">
                <!-- Hide/Show -->
                <button
                  onclick={() => matcher.toggleMultiHidden(idx)}
                  class="flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1
                    {isHidden
                      ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                      : 'bg-white/5 text-slate-500 hover:text-white border border-white/5'}"
                >
                  {#if isHidden}
                    <Eye class="w-3 h-3" /><span>Show</span>
                  {:else}
                    <EyeOff class="w-3 h-3" /><span>Hide</span>
                  {/if}
                </button>

                <!-- Snap -->
                <button
                  onclick={() => handleSnapProduct(idx)}
                  class="flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/15 hover:bg-blue-500/20"
                >
                  <Zap class="w-3 h-3" /><span>Snap</span>
                </button>

                <!-- Save single -->
                <button
                  onclick={() => handleSaveSingle(idx)}
                  disabled={ui.isProcessing}
                  class="flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/25 disabled:opacity-50"
                >
                  <Save class="w-3 h-3" /><span>Save</span>
                </button>

                <!-- Remove -->
                <button
                  onclick={() => handleRemoveProduct(idx)}
                  class="p-1.5 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/15 transition-all flex-shrink-0"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Per-product Transform/Shadow controls (active product only) -->
              {#if products.activeMultiIdx === idx}
                <div class="px-2 pb-3 border-t border-white/5 pt-2">
                  <TransformControls
                    transform={matcher.multiTransforms[idx] || { x: 0.5, y: 0.4, scale: 0.35, rotation: 0 }}
                    onChange={(u) => {
                      matcher.updateMultiTransform(idx, u);
                    }}
                    shadowConfig={matcher.multiShadows[idx] ?? DEFAULT_SHADOW}
                    onShadowChange={(u) => {
                      matcher.updateMultiShadow(idx, u);
                    }}
                  />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
