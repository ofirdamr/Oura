// Print-product pricing — the single source of truth for Mission A commerce.
//
// Values are taken directly from the premium-prints Stitch design
// (design/screens/oura_final_production_premium_prints_mobile): sizes ₪15/₪25/₪45,
// frames +₪89 (oak) / +₪75 (black) / +₪120 (gold), paper is a no-cost choice.
// The design's example total (₪104 = 10x15 ₪15 + oak +₪89) is the arithmetic
// this config reproduces exactly.
//
// All amounts are in AGOROT (integer minor units of ILS) — never floats — so
// every total is exact. The frontend fetches this same object via
// GET /prints/pricing so the catalog screen and the authoritative checkout
// computation can never drift out of sync. `computeUnitAgorot`/`computeItem`
// are the ONLY place a price is derived; the client's numbers are display-only
// and are recomputed here at checkout.

export type PrintSize = '10x15' | '13x18' | '20x30';
export type PrintPaper = 'matte' | 'glossy' | 'silk';
export type PrintFrame = 'none' | 'oak' | 'black' | 'gold';

export type PricingConfig = {
  currency: 'ils';
  // shipping shown as "חינם / free express" in the design → 0 agorot.
  shipping_agorot: number;
  sizes: { id: PrintSize; label: string; agorot: number }[];
  papers: { id: PrintPaper; label: string; sublabel: string; agorot: number }[];
  frames: { id: PrintFrame; label: string; agorot: number }[];
};

export const PRICING: PricingConfig = {
  currency: 'ils',
  shipping_agorot: 0,
  sizes: [
    { id: '10x15', label: '10x15', agorot: 1500 },
    { id: '13x18', label: '13x18', agorot: 2500 },
    { id: '20x30', label: '20x30', agorot: 4500 },
  ],
  papers: [
    { id: 'matte', label: 'נייר מט (Matte)', sublabel: 'גימור רך ללא השתקפויות', agorot: 0 },
    { id: 'glossy', label: 'נייר מבריק (Glossy)', sublabel: 'צבעים עזים וחדות מקסימלית', agorot: 0 },
    { id: 'silk', label: 'נייר משי (Silk)', sublabel: 'טקסטורה יוקרתית ועמידה', agorot: 0 },
  ],
  frames: [
    { id: 'none', label: 'ללא מסגרת', agorot: 0 },
    { id: 'black', label: 'שחור מט', agorot: 7500 },
    { id: 'oak', label: 'אלון טבעי', agorot: 8900 },
    { id: 'gold', label: 'זהב מוברש', agorot: 12000 },
  ],
};

export type PrintSelection = {
  size: PrintSize;
  paper: PrintPaper;
  frame: PrintFrame;
  quantity: number;
};

// Validated, priced line item — everything the checkout route needs to persist
// an order_items row and build a Stripe line item, computed authoritatively here.
export type PricedItem = {
  size: PrintSize;
  paper: PrintPaper;
  frame: PrintFrame;
  quantity: number;
  unit_agorot: number;
  line_agorot: number;
  title: string;
};

function findSize(id: unknown) {
  return PRICING.sizes.find((s) => s.id === id);
}
function findPaper(id: unknown) {
  return PRICING.papers.find((p) => p.id === id);
}
function findFrame(id: unknown) {
  // Absent/empty frame is a valid "no frame" selection.
  if (id === undefined || id === null || id === '' || id === 'none') {
    return PRICING.frames.find((f) => f.id === 'none');
  }
  return PRICING.frames.find((f) => f.id === id);
}

// Validate one raw client selection and compute its authoritative price.
// Returns null if any selection is invalid (unknown size/paper/frame, bad qty) —
// the caller rejects the whole checkout rather than silently guessing a price.
export function computeItem(raw: unknown): PricedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const size = findSize(r.size);
  const paper = findPaper(r.paper);
  const frame = findFrame(r.frame);
  if (!size || !paper || !frame) return null;

  const qtyNum = Number(r.quantity);
  if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 99) return null;

  const unit_agorot = size.agorot + paper.agorot + frame.agorot;
  const line_agorot = unit_agorot * qtyNum;

  // Hebrew title snapshot for the order record / Stripe line item.
  const frameSuffix = frame.id === 'none' ? '' : ` + מסגרת ${frame.label}`;
  const title = `הדפסת פרימיום ${size.label}${frameSuffix}`;

  return {
    size: size.id,
    paper: paper.id,
    frame: frame.id,
    quantity: qtyNum,
    unit_agorot,
    line_agorot,
    title,
  };
}
