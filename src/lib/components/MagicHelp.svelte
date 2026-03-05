<script lang="ts">
  import { MessageSquareText, Info, User, Package, Layers, Play, Zap, Hash, AlertCircle, CheckCircle2, Key } from 'lucide-svelte';

  const TOC = [
    { id: 'help-overview',   label: 'Overview',   color: 'text-indigo-400' },
    { id: 'help-model',      label: 'Model',      color: 'text-amber-400' },
    { id: 'help-product',    label: 'Product',     color: 'text-emerald-400' },
    { id: 'help-matcher',    label: 'Matcher',     color: 'text-violet-400' },
    { id: 'help-batch',      label: 'Batch',       color: 'text-rose-400' },
    { id: 'help-snap',       label: 'Auto-Snap',   color: 'text-yellow-400' },
    { id: 'help-filenames',  label: 'Filenames',   color: 'text-cyan-400' },
    { id: 'help-trouble',    label: 'Troubleshoot', color: 'text-orange-400' },
    { id: 'help-workflow',   label: 'Workflow',    color: 'text-emerald-400' },
    { id: 'help-metadata',   label: 'Metadata',    color: 'text-indigo-400' },
  ];

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<div class="col-span-12 animate-in fade-in slide-in-from-bottom-6 duration-700 flex flex-col" style="height: calc(100vh - 130px);">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-3 flex-shrink-0">
    <MessageSquareText class="w-5 h-5 text-indigo-400" />
    <h2 class="text-[14px] font-black uppercase tracking-widest text-white">KON-Magic Suite — User Guide</h2>
    <span class="ml-auto text-[9px] font-black text-slate-500 uppercase tracking-widest">v5.0 · Jewelry Visualization</span>
  </div>

  <!-- TOC -->
  <div class="flex-shrink-0 flex flex-wrap gap-1.5 mb-3 p-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.25rem] shadow-xl">
    {#each TOC as { id, label, color }}
      <button onclick={() => scrollTo(id)} class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all {color}">
        {label}
      </button>
    {/each}
  </div>

  <!-- Scrollable Content -->
  <div class="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pr-1" style="scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.3) transparent;">

    <!-- Overview -->
    <div id="help-overview" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><Info class="w-4 h-4 text-indigo-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-indigo-300">Overview</h3></div>
      <p class="text-slate-300 text-[12px] leading-relaxed">KON-Magic Suite is a professional browser-based tool for compositing jewelry product images onto model photos. It uses geometric anchor-point matching to automatically scale, rotate, and position any piece of jewelry onto a model — pixel-perfectly and proportionally correct.</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
        {#each [
          { tab: 'Model', desc: 'Load model photo, set anchors & reference height' },
          { tab: 'Product', desc: 'Load jewelry shots, set anchors & real height' },
          { tab: 'Matcher', desc: 'Compose & fine-tune, export PNG / PSD' },
          { tab: 'Batch', desc: 'Auto-match & save an entire product folder' },
          { tab: 'Info', desc: 'Live view of all embedded PNG metadata keys' },
        ] as { tab, desc }}
          <div class="flex flex-col gap-1.5 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
            <span class="text-[10px] font-black uppercase tracking-widest text-indigo-400">{tab}</span>
            <span class="text-[10px] text-slate-400 leading-relaxed">{desc}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Tab 1 — Model -->
    <div id="help-model" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><User class="w-4 h-4 text-amber-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-amber-300">Tab 1 — Model</h3></div>
      <ol class="list-decimal list-inside space-y-1.5 text-slate-300 text-[12px]">
        <li>Click <span class="text-white font-bold">Load Model</span> or click anywhere on the canvas to open a file</li>
        <li>Set <span class="text-white font-bold">Ref. Height (cm)</span> — the model's total visible body height in the photo</li>
        <li>Optionally set <span class="text-white font-bold">Skin Tone</span> and <span class="text-white font-bold">Model ID</span></li>
        <li>Place <span class="text-white font-bold">anchor points</span> by clicking on the canvas</li>
        <li>Click <span class="text-white font-bold">Save</span> to embed all data as PNG metadata</li>
      </ol>
      <div class="mt-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Anchor Points</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {#each [
            { anchor: 'Ear Center', color: '#fbbf24', use: 'Earrings' },
            { anchor: 'Ring Center', color: '#f87171', use: 'Rings' },
            { anchor: 'Necklace Left', color: '#a855f7', use: 'Necklaces (left side)' },
            { anchor: 'Necklace Right', color: '#ec4899', use: 'Necklaces (right side)' },
            { anchor: 'Bracelet Left', color: '#4ade80', use: 'Bracelets (left side)' },
            { anchor: 'Bracelet Right', color: '#60a5fa', use: 'Bracelets (right side)' },
          ] as { anchor, color, use }}
            <div class="flex items-center gap-2 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {color};"></span>
              <div>
                <span class="text-[10px] font-black text-white block">{anchor}</span>
                <span class="text-[9px] text-slate-400">{use}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tab 2 — Product -->
    <div id="help-product" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><Package class="w-4 h-4 text-emerald-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-emerald-300">Tab 2 — Product</h3></div>
      <ol class="list-decimal list-inside space-y-1.5 text-slate-300 text-[12px]">
        <li>Click <span class="text-white font-bold">Load Product</span> to open a jewelry image</li>
        <li>Select the <span class="text-white font-bold">jewelry form</span>: Earring · Ring · Necklace · Bracelet</li>
        <li>Enter the <span class="text-white font-bold">EAN number</span> (13 digits)</li>
        <li>For Earring / Ring: set <span class="text-white font-bold">Real Height (cm)</span></li>
        <li>Place <span class="text-white font-bold">anchor point(s)</span> by clicking on the canvas</li>
        <li>Click <span class="text-white font-bold">Save</span> to embed metadata</li>
      </ol>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {#each [
          { form: 'Earring', anchors: 'Center (C)', meaning: 'Where the hook attaches to the ear' },
          { form: 'Ring', anchors: 'Center (C)', meaning: 'Center of the ring band as worn on finger' },
          { form: 'Necklace', anchors: 'Left (L) + Right (R)', meaning: 'The two ends of the chain/clasp' },
          { form: 'Bracelet', anchors: 'Left (L) + Right (R)', meaning: 'The two ends of the bracelet/clasp' },
        ] as { form, anchors, meaning }}
          <div class="flex flex-col gap-1 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
            <span class="text-[10px] font-black text-white uppercase tracking-widest">{form}</span>
            <span class="text-[10px] text-indigo-400 font-bold">{anchors}</span>
            <span class="text-[10px] text-slate-400">{meaning}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Tab 3 — Matcher -->
    <div id="help-matcher" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><Layers class="w-4 h-4 text-violet-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-violet-300">Tab 3 — Matcher</h3></div>
      <ol class="list-decimal list-inside space-y-1.5 text-slate-300 text-[12px]">
        <li>Products loaded in the Product tab appear automatically</li>
        <li>Click <span class="text-white font-bold">Add Product</span> to add more from disk</li>
        <li>Products appear overlaid — drag to reposition</li>
        <li>Click <span class="text-white font-bold">⚡ Snap</span> for automatic placement</li>
        <li>Adjust shadow in TransformControls</li>
        <li>Toggle visibility with 👁; remove with 🗑</li>
      </ol>
      <div class="mt-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Export Options</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {#each [
            { btn: 'Export Separat', output: 'N × PNG files', desc: 'One PNG per product with metadata' },
            { btn: 'Export All Neu', output: '1 × PNG file', desc: 'All products composited on model' },
            { btn: 'Export PSD', output: '1 × PSD file', desc: 'Photoshop with named layers' },
          ] as { btn, output, desc }}
            <div class="flex flex-col gap-1 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
              <span class="text-[10px] font-black text-white uppercase tracking-widest">{btn}</span>
              <span class="text-[10px] text-indigo-400 font-bold">{output}</span>
              <span class="text-[10px] text-slate-400">{desc}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tab 4 — Batch -->
    <div id="help-batch" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><Play class="w-4 h-4 text-rose-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-rose-300">Tab 4 — Batch</h3></div>
      <p class="text-slate-300 text-[12px]">Batch lets you auto-match an entire folder of product PNGs against the loaded model.</p>
      <ol class="list-decimal list-inside space-y-1.5 text-slate-300 text-[12px] mt-3">
        <li>Switch to the <span class="text-white font-bold">Batch</span> tab</li>
        <li>Click <span class="text-white font-bold">Add Product Files</span></li>
        <li>Review the preview grid</li>
        <li>Click <span class="text-white font-bold">Match All</span></li>
        <li>Confirm — all files are matched and saved automatically</li>
      </ol>
    </div>

    <!-- Auto-Snap -->
    <div id="help-snap" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
      <div class="flex items-center gap-2 mb-3"><Zap class="w-4 h-4 text-yellow-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-yellow-300">How Auto-Snap Works</h3></div>
      <div class="space-y-2">
        <p class="text-[11px] font-black uppercase tracking-widest text-white">Mode A — Center Mode (Earring & Ring)</p>
        <p class="text-slate-400 text-[11px] italic">Scale = product real height ÷ model ref height. Position centered on ear/ring anchor.</p>
      </div>
      <div class="border-t border-white/5 pt-4 space-y-2">
        <p class="text-[11px] font-black uppercase tracking-widest text-white">Mode B — Dual Mode (Necklace & Bracelet)</p>
        <p class="text-slate-400 text-[11px] italic">Scale = model L↔R distance ÷ product L↔R distance. Rotation = angle difference. Left anchor snaps to model left anchor.</p>
      </div>
    </div>

    <!-- Filenames -->
    <div id="help-filenames" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
      <div class="flex items-center gap-2 mb-3"><Hash class="w-4 h-4 text-cyan-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-cyan-300">Filename Format</h3></div>
      <div class="bg-black/30 rounded-xl px-4 py-3 border border-cyan-500/20 font-mono text-[13px] text-cyan-300 tracking-wide">
        AI_&lt;ModelPicId&gt;_&lt;FormPrefix&gt;_&lt;EAN&gt;.png
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {#each [
          { prefix: 'E', form: 'Earring' },
          { prefix: 'R', form: 'Ring' },
          { prefix: 'N', form: 'Necklace' },
          { prefix: 'B', form: 'Bracelet' },
        ] as { prefix, form }}
          <div class="flex items-center gap-3 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
            <code class="text-[16px] font-black text-cyan-300">{prefix}</code>
            <span class="text-[11px] text-slate-300">{form}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Troubleshooting -->
    <div id="help-trouble" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><AlertCircle class="w-4 h-4 text-orange-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-orange-300">Troubleshooting</h3></div>
      <div class="space-y-2">
        {#each [
          { symptom: 'Snap has no effect', cause: 'Required anchors missing', fix: 'Set all required anchor points' },
          { symptom: 'Wrong size on snap', cause: 'Height values missing', fix: 'Set both Ref. Height and Real Height' },
          { symptom: 'Wrong angle', cause: 'Only one anchor set', fix: 'Set both L and R anchors' },
          { symptom: 'Batch produces nothing', cause: 'No PNG metadata', fix: 'Save products via Product tab first' },
          { symptom: 'White background remains', cause: 'AI removal incomplete', fix: 'Use AI Crop after AI Background Remover' },
        ] as { symptom, cause, fix }}
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
            <div><span class="text-[9px] font-black text-orange-400 uppercase tracking-widest block mb-0.5">Symptom</span><span class="text-[11px] text-white">{symptom}</span></div>
            <div><span class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Cause</span><span class="text-[11px] text-slate-400">{cause}</span></div>
            <div><span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Fix</span><span class="text-[11px] text-slate-300">{fix}</span></div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Workflow -->
    <div id="help-workflow" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
      <div class="flex items-center gap-2 mb-3"><CheckCircle2 class="w-4 h-4 text-emerald-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-emerald-300">Recommended Workflow</h3></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {#each [
          { step: '1', title: 'Prepare Model', items: ['Load model → Model tab', 'Set Ref. Height', 'Set Model ID', 'Place anchors', 'Save'] },
          { step: '2', title: 'Prepare Products', items: ['Load product → Product tab', 'Select form', 'Enter EAN', 'AI BG Remover + AI Crop', 'Set height + anchors', 'Save'] },
          { step: '3', title: 'Single Match', items: ['Go to Matcher', 'Add products → Snap', 'Fine-tune if needed', 'Export'] },
          { step: '4', title: 'Bulk Production', items: ['Model loaded', 'Go to Batch', 'Add saved PNGs', 'Match All → Confirm'] },
        ] as { step, title, items }}
          <div class="flex flex-col gap-2 bg-white/3 rounded-xl px-3 py-3 border border-white/5">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-black text-white flex-shrink-0">{step}</span>
              <span class="text-[10px] font-black uppercase tracking-widest text-white">{title}</span>
            </div>
            <ul class="space-y-1">
              {#each items as item}
                <li class="text-[10px] text-slate-400 flex gap-1.5"><span class="text-indigo-500 flex-shrink-0">›</span>{item}</li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>

    <!-- Metadata Reference -->
    <div id="help-metadata" class="p-4 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
      <div class="flex items-center gap-2 mb-3"><Key class="w-4 h-4 text-indigo-400" /><h3 class="text-[12px] font-black uppercase tracking-widest text-indigo-300">PNG Metadata Reference</h3></div>
      <p class="text-slate-400 text-[11px]">All metadata is embedded as tEXt chunks inside PNG files.</p>
      <div class="space-y-2">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Model Shot Keys</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {#each [
            { key: 'PicType', type: 'string', desc: 'Always ModelShot' },
            { key: 'ModelPicId', type: 'number', desc: 'Unique model identifier' },
            { key: 'ModelSkin', type: 'hex color', desc: 'Skin tone' },
            { key: 'PicX', type: 'float', desc: 'Reference height in cm' },
            { key: 'ModelAnchorEarC', type: 'x,y', desc: 'Ear center anchor (%)' },
            { key: 'ModelAnchorRingC', type: 'x,y', desc: 'Ring center anchor (%)' },
            { key: 'ModelAnchorNecklaceL', type: 'x,y', desc: 'Necklace left anchor (%)' },
            { key: 'ModelAnchorNecklaceR', type: 'x,y', desc: 'Necklace right anchor (%)' },
            { key: 'ModelAnchorBraceletL', type: 'x,y', desc: 'Bracelet left anchor (%)' },
            { key: 'ModelAnchorBraceletR', type: 'x,y', desc: 'Bracelet right anchor (%)' },
          ] as { key, type, desc }}
            <div class="flex items-start gap-2 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
              <code class="text-[10px] font-mono text-indigo-300 flex-shrink-0 min-w-[140px]">{key}</code>
              <div class="flex flex-col gap-0.5">
                <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">{type}</span>
                <span class="text-[10px] text-slate-400">{desc}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="space-y-2 mt-2">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Product Shot Keys</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {#each [
            { key: 'PicType', type: 'string', desc: 'Always ProductShot' },
            { key: 'PicForm', type: 'string', desc: 'Earring · Ring · Necklace · Bracelet' },
            { key: 'EAN-Nummer', type: 'string', desc: '13-digit EAN barcode' },
            { key: 'PicX', type: 'float', desc: 'Real height in cm' },
            { key: 'PicShadow', type: 'string', desc: 'Shadow config (serialised)' },
            { key: 'ProductAnchorC', type: 'x,y', desc: 'Center anchor' },
            { key: 'ProductAnchorL', type: 'x,y', desc: 'Left anchor' },
            { key: 'ProductAnchorR', type: 'x,y', desc: 'Right anchor' },
          ] as { key, type, desc }}
            <div class="flex items-start gap-2 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
              <code class="text-[10px] font-mono text-emerald-300 flex-shrink-0 min-w-[140px]">{key}</code>
              <div class="flex flex-col gap-0.5">
                <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">{type}</span>
                <span class="text-[10px] text-slate-400">{desc}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center py-4">
      <p class="text-slate-600 text-[10px] font-black uppercase tracking-widest">KON-Magic Suite · Built for Konplott · v5.0 Svelte 5</p>
    </div>
  </div>
</div>
