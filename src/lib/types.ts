
export type PicForm = 'Earring' | 'Ring' | 'Necklace' | 'Bracelet';
export type AppWorkflow = 'MagicModel' | 'MagicMatcher' | 'MagicProductShot' | 'MagicBatch' | 'MagicInfo' | 'MagicHelp';

export interface AnchorPoint {
  x: number;
  y: number;
}

// ── Model-Bild ──────────────────────────────────────────────────────────────
export interface ModelImageState {
  url: string;
  name: string;
  picType: 'ModelShot';
  picX: number;             // Referenzhöhe in cm
  modelSkin?: string;       // Hautfarbe z.B. '#c68642'
  modelPicId?: number;      // Model-ID-Nummer
  // 6 benannte Anker-Felder:
  modelAnchorEarC:      AnchorPoint | null;  // Earring  Center
  modelAnchorRingC:     AnchorPoint | null;  // Ring     Center
  modelAnchorNecklaceL: AnchorPoint | null;  // Necklace Left
  modelAnchorNecklaceR: AnchorPoint | null;  // Necklace Right
  modelAnchorBraceletL: AnchorPoint | null;  // Bracelet Left
  modelAnchorBraceletR: AnchorPoint | null;  // Bracelet Right
}

// ── Produkt-Bild ────────────────────────────────────────────────────────────
export interface ProductImageState {
  url: string;
  name: string;
  picType: 'ProductShot';
  picForm: PicForm;
  picX: number;             // Realhöhe in cm (Center-Modus)
  ean?: string;
  productAnchorC: AnchorPoint | null;  // Center  (Earring, Ring)
  productAnchorL: AnchorPoint | null;  // Left    (Necklace, Bracelet)
  productAnchorR: AnchorPoint | null;  // Right   (Necklace, Bracelet)
}

export type ImageState = ModelImageState | ProductImageState;

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface ShadowConfig {
  enabled: boolean;
  opacity: number;
  blur: number;
  x: number;
  y: number;
  color: string;
  size: number;
}
