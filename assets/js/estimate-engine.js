// LG Roofing Materials — estimate calculation engine
// Pure functions only: no DOM access. This is the single source of truth for
// quantities and prices. Nothing outside this file may compute a $ figure —
// that includes any future AI/chat layer, which must call these functions
// rather than reasoning about numbers itself.
//
// Everything except shingles is a direct customer-entered quantity (bundles,
// rolls, pieces, boxes) — most of LG's clients are contractors who already
// know exactly what they need, so there's no linear-footage/waste-factor
// derivation here. Shingles are the one exception: customers think in
// "squares," so that's converted to bundles at a fixed 3 bundles/square.

const money = (n) => Math.round(n * 100) / 100;
const ceilTo = (n) => Math.ceil(n - 1e-9); // guard against float rounding (e.g. 3.0000000004)

/** Shingles: squares -> bundles, always 3 bundles/square on this price list. No waste factor. */
function calcShingles(product, squares, bundlesPerSquare) {
  if (!squares || squares <= 0) return null;
  const bundles = ceilTo(squares * bundlesPerSquare);
  return {
    key: 'shingles',
    label: `${product.brand} ${product.name}`,
    qty: bundles,
    unit: 'bundle',
    unitPrice: product.unitPrice,
    cost: money(bundles * product.unitPrice),
    confidence: 'confirmed',
    note: null,
  };
}

/** Every other line item: a direct customer-entered quantity in its natural unit. */
function calcDirectQty(key, product, qty, unit) {
  if (!product || !qty || qty <= 0) return null;
  const roundedQty = ceilTo(qty);
  return {
    key,
    label: product.brand ? `${product.brand} ${product.name}` : product.name,
    qty: roundedQty,
    unit,
    unitPrice: product.unitPrice,
    cost: money(roundedQty * product.unitPrice),
    confidence: product.confidence || 'confirmed',
    note: product.note || null,
  };
}

/**
 * Build the full itemized estimate.
 * `catalog` is the parsed products.json. `input` is the structured form state (see estimate-ui.js).
 * Returns { lineItems: [...], fulfillmentFee, total, flaggedCount }.
 * NOTE: this returns full per-line pricing for internal/staff use (e.g. the emailed
 * breakdown). The customer-facing UI is responsible for hiding per-line prices —
 * see estimate-ui.js renderSummary(), which only displays name + qty, never li.cost.
 */
function buildEstimate(catalog, input) {
  const { meta } = catalog;
  const squares = Number(input.squares) || 0;
  const lineItems = [];

  if (input.shingle) {
    const item = calcShingles(input.shingle, squares, meta.bundlesPerSquare);
    if (item) lineItems.push(item);
  }
  if (input.hipRidge) {
    const item = calcDirectQty('hipRidge', input.hipRidge, input.hipRidgeQty, 'bundle');
    if (item) lineItems.push(item);
  }
  if (input.starter) {
    const item = calcDirectQty('starter', input.starter, input.starterQty, 'bundle');
    if (item) lineItems.push(item);
  }
  if (input.underlayment) {
    const item = calcDirectQty('underlayment', input.underlayment, input.underlaymentQty, 'roll');
    if (item) lineItems.push(item);
  }
  if (input.leakBarrier) {
    const item = calcDirectQty('leakBarrier', input.leakBarrier, input.leakBarrierQty, 'roll');
    if (item) lineItems.push(item);
  }
  if (input.coilNails) {
    const item = calcDirectQty('coilNails', input.coilNails, input.coilNailsQty, 'box');
    if (item) lineItems.push(item);
  }
  if (input.capNails) {
    const item = calcDirectQty('capNails', input.capNails, input.capNailsQty, 'box');
    if (item) lineItems.push(item);
  }
  if (input.ridgeVent) {
    const item = calcDirectQty('ridgeVent', input.ridgeVent, input.ridgeVentQty, 'piece');
    if (item) lineItems.push(item);
  }
  if (input.dripEdge) {
    const item = calcDirectQty('dripEdge', input.dripEdge, input.dripEdgeQty, 'piece');
    if (item) lineItems.push(item);
  }
  if (input.valleyMetal) {
    const item = calcDirectQty('valleyMetal', input.valleyMetal, input.valleyMetalQty, 'roll');
    if (item) lineItems.push(item);
  }
  if (input.decking) {
    const item = calcDirectQty('decking', input.decking, input.deckingQty, 'sheet');
    if (item) lineItems.push(item);
  }
  (input.staticVents || []).forEach((sel) => {
    const item = calcDirectQty('staticVent', sel.product, sel.qty, 'piece');
    if (item) lineItems.push(item);
  });
  (input.flashingAccessories || []).forEach((sel) => {
    const item = calcDirectQty('flashingAccessory', sel.product, sel.qty, 'piece');
    if (item) lineItems.push(item);
  });
  (input.flatRoofItems || []).forEach((sel) => {
    const item = calcDirectQty('flatRoof', sel.product, sel.qty, 'piece');
    if (item) lineItems.push(item);
  });
  (input.addOnItems || []).forEach((sel) => {
    const item = calcDirectQty('addOn', sel.product, sel.qty, 'piece');
    if (item) lineItems.push(item);
  });

  const materialsSubtotal = money(lineItems.reduce((sum, li) => sum + li.cost, 0));
  const fulfillmentFee = input.fulfillment === 'delivery' ? meta.deliveryFee : meta.pickupFee;
  const total = money(materialsSubtotal + fulfillmentFee);
  const flaggedCount = lineItems.filter((li) => li.confidence !== 'confirmed').length;

  return { lineItems, materialsSubtotal, fulfillmentFee, total, flaggedCount };
}

// Exposed as a plain global — this site has no build step / module bundler.
window.EstimateEngine = { buildEstimate, money, ceilTo };
