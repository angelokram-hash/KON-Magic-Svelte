<script lang="ts">
  import { X, Check, Crop as CropIcon } from 'lucide-svelte';

  interface Props {
    imageUrl: string;
    onCrop: (croppedUrl: string) => void;
    onCancel: () => void;
  }

  let { imageUrl, onCrop, onCancel }: Props = $props();

  type InteractionType = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

  let crop = $state({ x: 10, y: 10, width: 40, height: 40 });
  let interaction = $state<InteractionType>(null);
  let startPos = $state({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  let imgEl: HTMLImageElement | undefined = $state();

  function handleInteractionStart(e: MouseEvent | TouchEvent, type: InteractionType) {
    if (e.cancelable) e.preventDefault();
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    interaction = type;
    startPos = { x: clientX, y: clientY, cropX: crop.x, cropY: crop.y, cropW: crop.width, cropH: crop.height };
  }

  function handleInteractionMove(e: MouseEvent | TouchEvent) {
    if (!interaction || !imgEl) return;
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    const rect = imgEl.getBoundingClientRect();
    const deltaX = ((clientX - startPos.x) / rect.width) * 100;
    const deltaY = ((clientY - startPos.y) / rect.height) * 100;

    let { x, y, width, height } = crop;

    if (interaction === 'move') {
      x = Math.max(0, Math.min(100 - width, startPos.cropX + deltaX));
      y = Math.max(0, Math.min(100 - height, startPos.cropY + deltaY));
    } else {
      if (interaction.includes('n')) {
        const newY = Math.max(0, Math.min(startPos.cropY + startPos.cropH - 5, startPos.cropY + deltaY));
        height = startPos.cropH + (startPos.cropY - newY);
        y = newY;
      }
      if (interaction.includes('s')) {
        height = Math.max(5, Math.min(100 - startPos.cropY, startPos.cropH + deltaY));
      }
      if (interaction.includes('w')) {
        const newX = Math.max(0, Math.min(startPos.cropX + startPos.cropW - 5, startPos.cropX + deltaX));
        width = startPos.cropW + (startPos.cropX - newX);
        x = newX;
      }
      if (interaction.includes('e')) {
        width = Math.max(5, Math.min(100 - startPos.cropX, startPos.cropW + deltaX));
      }
    }

    crop = { x, y, width, height };
  }

  function handleInteractionEnd() {
    interaction = null;
  }

  // Global event listeners when interacting
  $effect(() => {
    if (!interaction) return;
    const move = (e: MouseEvent | TouchEvent) => handleInteractionMove(e);
    const end = () => handleInteractionEnd();
    window.addEventListener('mousemove', move as any);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move as any, { passive: false });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('mousemove', move as any);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move as any);
      window.removeEventListener('touchend', end);
    };
  });

  function handleApply() {
    if (!imgEl) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const naturalW = imgEl.naturalWidth;
    const naturalH = imgEl.naturalHeight;
    const pixelX = (crop.x / 100) * naturalW;
    const pixelY = (crop.y / 100) * naturalH;
    const pixelW = (crop.width / 100) * naturalW;
    const pixelH = (crop.height / 100) * naturalH;
    canvas.width = pixelW;
    canvas.height = pixelH;
    ctx.drawImage(imgEl, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
    onCrop(canvas.toDataURL('image/png'));
  }

  let clipPath = $derived(`polygon(0% 0%, 0% 100%, ${crop.x}% 100%, ${crop.x}% ${crop.y}%, ${crop.x + crop.width}% ${crop.y}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, ${crop.x}% ${crop.y + crop.height}%, ${crop.x}% 100%, 100% 100%, 100% 0%)`);
</script>

<div class="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-8">
  <div class="max-w-4xl w-full bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-full">
    <!-- Header -->
    <div class="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-500/10 rounded-lg">
          <CropIcon class="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 class="font-black text-sm uppercase tracking-widest">Select Crop Area</h3>
          <p class="text-[10px] text-slate-500 uppercase font-bold">Drag and resize the frame</p>
        </div>
      </div>
      <button onclick={onCancel} class="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
        <X class="w-6 h-6" />
      </button>
    </div>

    <!-- Crop Area -->
    <div class="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden min-h-[300px] p-4 md:p-12">
      <div class="relative inline-block select-none">
        <img
          bind:this={imgEl}
          src={imageUrl}
          class="max-h-[60vh] object-contain block select-none pointer-events-none"
          alt="To crop"
        />

        <!-- Dark Overlay Outside -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute bg-black/60 inset-0" style="clip-path: {clipPath}"></div>
        </div>

        <!-- Editable Crop Box -->
        <div
          class="absolute border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-move {interaction === 'move' ? 'opacity-90' : 'opacity-100'}"
          style="left: {crop.x}%; top: {crop.y}%; width: {crop.width}%; height: {crop.height}%;"
          onmousedown={(e) => handleInteractionStart(e, 'move')}
          ontouchstart={(e) => handleInteractionStart(e, 'move')}
          role="presentation"
        >
          <!-- Corner Handles -->
          {#each [
            { pos: '-top-3 -left-3', cursor: 'cursor-nw-resize', type: 'nw' as InteractionType },
            { pos: '-top-3 -right-3', cursor: 'cursor-ne-resize', type: 'ne' as InteractionType },
            { pos: '-bottom-3 -left-3', cursor: 'cursor-sw-resize', type: 'sw' as InteractionType },
            { pos: '-bottom-3 -right-3', cursor: 'cursor-se-resize', type: 'se' as InteractionType },
          ] as handle}
            <div
              class="absolute {handle.pos} w-8 h-8 flex items-center justify-center {handle.cursor} z-10"
              onmousedown={(e) => { e.stopPropagation(); handleInteractionStart(e, handle.type); }}
              ontouchstart={(e) => { e.stopPropagation(); handleInteractionStart(e, handle.type); }}
              role="presentation"
            >
              <div class="w-5 h-5 bg-white border-2 border-blue-500 rounded-full shadow-lg"></div>
            </div>
          {/each}

          <!-- Center crosshair -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div class="w-full h-px bg-blue-400"></div>
            <div class="h-full w-px bg-blue-400 absolute"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-8 border-t border-slate-800 flex justify-center md:justify-end gap-4 bg-slate-900/50">
      <button
        onclick={onCancel}
        class="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
      >
        Cancel
      </button>
      <button
        onclick={handleApply}
        class="px-10 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
      >
        <Check class="w-4 h-4" /> Confirm
      </button>
    </div>
  </div>
</div>
