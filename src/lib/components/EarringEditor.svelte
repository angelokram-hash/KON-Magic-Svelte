<script lang="ts">
  import type { TransformState, AnchorPoint, ShadowConfig, PicForm } from '$lib/types';
  import { UI_BASE_WIDTH } from '$lib/utils/snap';

  interface Props {
    modelUrl: string;
    earringUrl: string;
    transform: TransformState;
    onTransformChange: (t: TransformState) => void;
    modelAnchorForForm: AnchorPoint | null;
    productAnchorC: AnchorPoint | null;
    productAnchorL?: AnchorPoint | null;
    productAnchorR?: AnchorPoint | null;
    anchorColor: string;
    currentPicForm: PicForm;
    shadowConfig?: ShadowConfig;
    modelShotDims: { width: number; height: number } | null;
    onDragEnd?: () => void;
  }

  let {
    modelUrl, earringUrl, transform, onTransformChange,
    modelAnchorForForm, productAnchorC, productAnchorL, productAnchorR,
    anchorColor, currentPicForm, shadowConfig, modelShotDims, onDragEnd
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);
  let dragStart = $state({ x: 0, y: 0 });
  let containerSize = $state({ width: 0, height: 0 });

  // ResizeObserver for container
  $effect(() => {
    if (!containerEl) return;
    const updateSize = () => {
      if (containerEl) {
        containerSize = { width: containerEl.clientWidth, height: containerEl.clientHeight };
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerEl);
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  });

  // Model bounds (object-contain calculation)
  let modelBounds = $derived.by(() => {
    if (!containerSize.width || !containerSize.height || !modelShotDims) return null;
    const containerAspect = containerSize.width / containerSize.height;
    const imageAspect = modelShotDims.width / modelShotDims.height;
    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (imageAspect > containerAspect) {
      renderedW = containerSize.width;
      renderedH = containerSize.width / imageAspect;
      offsetX = 0;
      offsetY = (containerSize.height - renderedH) / 2;
    } else {
      renderedH = containerSize.height;
      renderedW = containerSize.height * imageAspect;
      offsetX = (containerSize.width - renderedW) / 2;
      offsetY = 0;
    }
    return { renderedW, renderedH, offsetX, offsetY };
  });

  function getShadowStyle(): string {
    if (!shadowConfig?.enabled || !containerSize.width) return 'none';
    const intensity = shadowConfig.size || 1.0;
    const blurPx = (shadowConfig.blur / 100) * containerSize.width * intensity;
    const xPx = (shadowConfig.x / 100) * containerSize.width * intensity;
    const yPx = (shadowConfig.y / 100) * containerSize.height * intensity;
    const color = shadowConfig.color;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `drop-shadow(${xPx}px ${yPx}px ${blurPx}px rgba(${r}, ${g}, ${b}, ${shadowConfig.opacity}))`;
  }

  function handleStart(clientX: number, clientY: number) {
    isDragging = true;
    dragStart = { x: clientX - transform.x, y: clientY - transform.y };
  }

  function handleMove(clientX: number, clientY: number) {
    if (!isDragging) return;
    onTransformChange({ ...transform, x: clientX - dragStart.x, y: clientY - dragStart.y });
  }

  function handleEnd() {
    if (isDragging) {
      isDragging = false;
      onDragEnd?.();
    }
  }

  let isDual = $derived(currentPicForm === 'Necklace' || currentPicForm === 'Bracelet');
</script>

<div
  bind:this={containerEl}
  id="editor-canvas-container"
  class="relative w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 bg-black touch-none select-none"
  onmousemove={(e) => handleMove(e.clientX, e.clientY)}
  onmouseup={handleEnd}
  onmouseleave={handleEnd}
  role="presentation"
>
  <img src={modelUrl} alt="Model" class="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-90" />

  <!-- Model anchor dot for current form -->
  {#if modelAnchorForForm && modelBounds}
    <div
      class="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full shadow-glow flex items-center justify-center z-20 pointer-events-none"
      style="left: {modelBounds.offsetX + (modelAnchorForForm.x / 100) * modelBounds.renderedW}px; top: {modelBounds.offsetY + (modelAnchorForForm.y / 100) * modelBounds.renderedH}px; background-color: {anchorColor}77;"
    >
      <div class="w-1.5 h-1.5 bg-white rounded-full shadow-sm animate-pulse"></div>
    </div>
  {/if}

  {#if earringUrl}
    <div
      class="absolute flex-none cursor-move {isDragging ? 'z-50' : 'z-10'}"
      style="left: {transform.x}px; top: {transform.y}px; width: {UI_BASE_WIDTH}px; transform: translate(-50%, -50%) rotate({transform.rotation}deg) scale({transform.scale});"
      onmousedown={(e) => handleStart(e.clientX, e.clientY)}
      ontouchstart={(e) => { e.preventDefault(); handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
      ontouchmove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }}
      ontouchend={handleEnd}
      role="presentation"
    >
      <div class="relative w-full {isDragging ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-white/20'} ring-offset-4 ring-offset-transparent rounded-lg transition-all duration-200">
        <img src={earringUrl} alt="Product" style="filter: {getShadowStyle()}" class="w-full h-auto pointer-events-none block" />

        <!-- Center anchor (Earring / Ring) -->
        {#if !isDual && productAnchorC}
          <div
            class="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full shadow-2xl flex items-center justify-center z-30 pointer-events-none"
            style="left: {productAnchorC.x}%; top: {productAnchorC.y}%; background-color: {anchorColor}bb;"
          >
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        {/if}

        <!-- Dual anchors (Necklace / Bracelet) -->
        {#if isDual && productAnchorL}
          <div
            class="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full shadow-2xl flex items-center justify-center z-30 pointer-events-none"
            style="left: {productAnchorL.x}%; top: {productAnchorL.y}%; background-color: #a855f7bb;"
          >
            <span class="text-[8px] font-black text-white">L</span>
          </div>
        {/if}
        {#if isDual && productAnchorR}
          <div
            class="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full shadow-2xl flex items-center justify-center z-30 pointer-events-none"
            style="left: {productAnchorR.x}%; top: {productAnchorR.y}%; background-color: #ec4899bb;"
          >
            <span class="text-[8px] font-black text-white">R</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
