<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import MagicModel from '$lib/components/MagicModel.svelte';
  import MagicProduct from '$lib/components/MagicProduct.svelte';
  import MagicMatcher from '$lib/components/MagicMatcher.svelte';
  import MagicBatch from '$lib/components/MagicBatch.svelte';
  import MagicInfo from '$lib/components/MagicInfo.svelte';
  import MagicHelp from '$lib/components/MagicHelp.svelte';
  import ImageCropper from '$lib/components/ImageCropper.svelte';
  import FormSelectModal from '$lib/components/FormSelectModal.svelte';
  import ValidationModal from '$lib/components/ValidationModal.svelte';
  import type { AppWorkflow } from '$lib/types';
  import { getUIStore } from '$lib/stores/ui.svelte';
  import { getModelStore } from '$lib/stores/model.svelte';
  import { getProductsStore } from '$lib/stores/products.svelte';

  const ui = getUIStore();
  const model = getModelStore();
  const products = getProductsStore();

  function handleWorkflowChange(wf: AppWorkflow) {
    ui.setWorkflow(wf);
  }

  // ─── Crop Handling ───────────────────────────────────────────────
  function handleCropComplete(croppedUrl: string) {
    const target = ui.croppingTarget;
    if (target === 'ModelShot' && model.modelShot) {
      model.updateModelShot({ url: croppedUrl });
    } else if (target === 'ProductShot' && products.productShot) {
      products.updateProductShot({ url: croppedUrl });
    }
    ui.setCroppingTarget(null);
  }

  function handleCropCancel() {
    ui.setCroppingTarget(null);
  }

  // Get the image URL for the crop target
  function getCropImageUrl(): string | null {
    if (ui.croppingTarget === 'ModelShot') return model.modelShot?.url ?? null;
    if (ui.croppingTarget === 'ProductShot') return products.productShot?.url ?? null;
    return null;
  }
</script>

<div class="min-h-screen bg-[#050505] text-slate-200 font-sans flex flex-col overflow-hidden" style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;">
  <Header
    currentWorkflow={ui.currentWorkflow}
    onWorkflowChange={handleWorkflowChange}
  />

  <main class="flex-1 mt-14 sm:mt-20 lg:mt-24 p-3 sm:p-5 lg:p-8 max-w-[1700px] mx-auto w-full grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8 overflow-y-auto">

    {#if ui.currentWorkflow === 'MagicModel'}
      <MagicModel />

    {:else if ui.currentWorkflow === 'MagicProductShot'}
      <MagicProduct />

    {:else if ui.currentWorkflow === 'MagicMatcher'}
      <MagicMatcher />

    {:else if ui.currentWorkflow === 'MagicBatch'}
      <MagicBatch />

    {:else if ui.currentWorkflow === 'MagicInfo'}
      <MagicInfo />

    {:else if ui.currentWorkflow === 'MagicHelp'}
      <MagicHelp />
    {/if}

  </main>
</div>

<!-- Global Modals -->

{#if ui.croppingTarget && getCropImageUrl()}
  <ImageCropper
    imageUrl={getCropImageUrl()!}
    onCrop={handleCropComplete}
    onCancel={handleCropCancel}
  />
{/if}

{#if ui.formSelectModal}
  <FormSelectModal
    onSelect={(form) => {
      ui.formSelectModal?.onSelect(form);
      ui.closeFormSelect();
    }}
    onCancel={() => ui.closeFormSelect()}
  />
{/if}

{#if ui.validationModal}
  <ValidationModal
    message={ui.validationModal.message}
    previewUrl={ui.validationModal.previewUrl}
    onConfirm={() => { ui.validationModal?.onConfirm(); ui.closeValidation(); }}
    onCancel={ui.validationModal.onCancel ? () => { ui.validationModal?.onCancel?.(); ui.closeValidation(); } : undefined}
    onExtra={ui.validationModal.onExtra ? () => { ui.validationModal?.onExtra?.(); ui.closeValidation(); } : undefined}
    confirmLabel={ui.validationModal.confirmLabel}
    cancelLabel={ui.validationModal.cancelLabel}
    extraLabel={ui.validationModal.extraLabel}
    confirmStyle={ui.validationModal.confirmStyle}
    extraStyle={ui.validationModal.extraStyle}
  />
{/if}
