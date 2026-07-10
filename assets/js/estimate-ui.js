// LG Roofing Materials — estimate page interaction layer.
// This file only reads form state and renders output. All quantity/price
// math happens in estimate-engine.js — nothing here computes a dollar figure.
//
// Customer-facing rule: no per-item prices are ever rendered to the page.
// Only the fulfillment fee and the grand total are shown. Full itemized
// pricing still goes to LG's team in the Formspree submission (see
// buildStaffSummaryText) — that's an internal fulfillment need, not something
// shown on screen.

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('estimate-form');
  if (!form) return;

  const res = await fetch('assets/data/products.json');
  const catalog = await res.json();

  const BRAND_WARNING_DOMAINS = {
    'GAF': 'https://www.gaf.com',
    'CertainTeed': 'https://www.certainteed.com',
    'Owens Corning': 'https://www.owenscorning.com',
    'IKO': 'https://www.iko.com',
    'Atlas': 'https://www.atlasroofing.com',
  };
  // Tamko's own install literature explicitly allows ASTM-equivalent generic
  // accessories, so it's excluded from the brand-mismatch warning group.
  const STRICT_WARRANTY_BRANDS = new Set(Object.keys(BRAND_WARNING_DOMAINS));

  const $ = (id) => document.getElementById(id);
  const money = (n) => `$${n.toFixed(2)}`;

  function fillSelect(select, items, { valueFn, labelFn } = {}) {
    const vf = valueFn || ((item, i) => String(i));
    const lf = labelFn || ((item) => item.name);
    select.innerHTML = items.map((item, i) =>
      `<option value="${vf(item, i)}">${lf(item)}</option>`).join('');
  }

  // ---- Step 1: Shingles ----
  const shingleBrands = [...new Set(catalog.shingles.map((s) => s.brand))];
  const shingleBrandSelect = $('shingle-brand');
  shingleBrandSelect.innerHTML = shingleBrands.map((b) => `<option value="${b}">${b}</option>`).join('');

  function populateShingleProducts() {
    const brand = shingleBrandSelect.value;
    const products = catalog.shingles.filter((s) => s.brand === brand);
    fillSelect($('shingle-product'), products, {
      valueFn: (item) => catalog.shingles.indexOf(item),
    });
  }
  shingleBrandSelect.addEventListener('change', () => { populateShingleProducts(); onShingleChanged(); recalc(); });
  populateShingleProducts();

  function updateBundleReadout() {
    const squares = Number($('squares').value) || 0;
    const bundles = squares > 0 ? Math.ceil(squares * catalog.meta.bundlesPerSquare) : 0;
    $('squares-bundles').textContent = squares > 0 ? `= ${bundles} bundles` : '';
  }
  $('squares').addEventListener('input', () => { updateBundleReadout(); recalc(); });

  // ---- Generic brand -> product linked category (Hip & Ridge, Starter, Underlayment, Leak Barrier, Ridge Vent) ----
  function setupLinkedCategory({ brandId, productId, list, warningId }) {
    const brandSelect = $(brandId);
    const productSelect = $(productId);
    const brands = [...new Set(list.map((p) => p.brand))];
    brandSelect.innerHTML = brands.map((b) => `<option value="${b}">${b}</option>`).join('');

    function populateProducts() {
      const products = list.filter((p) => p.brand === brandSelect.value);
      fillSelect(productSelect, products, { valueFn: (item) => list.indexOf(item) });
    }
    populateProducts();

    let touched = false;
    brandSelect.addEventListener('change', () => { touched = true; populateProducts(); recalc(); });
    productSelect.addEventListener('change', () => { touched = true; recalc(); });

    return {
      getSelected: () => list[Number(productSelect.value)] || null,
      suggestBrand(brand) {
        if (touched) return;
        if (brands.includes(brand)) brandSelect.value = brand;
        populateProducts();
      },
      isTouched: () => touched,
      warningId,
      list,
    };
  }

  const hipRidgeCat = setupLinkedCategory({ brandId: 'hipridge-brand', productId: 'hipridge-product', list: catalog.hipRidge, warningId: 'hipridge-warning' });
  const starterCat = setupLinkedCategory({ brandId: 'starter-brand', productId: 'starter-product', list: catalog.starter, warningId: 'starter-warning' });
  const underlaymentCat = setupLinkedCategory({ brandId: 'underlayment-brand', productId: 'underlayment-product', list: catalog.underlayment });
  const leakBarrierCat = setupLinkedCategory({ brandId: 'leakbarrier-brand', productId: 'leakbarrier-product', list: catalog.leakBarrier });
  const ridgeVentCat = setupLinkedCategory({ brandId: 'ridgevent-brand', productId: 'ridgevent-product', list: catalog.ventilationRidge });

  function onShingleChanged() {
    const shingleIdx = Number($('shingle-product').value);
    const shingle = catalog.shingles[shingleIdx];
    if (!shingle) return;
    hipRidgeCat.suggestBrand(shingle.brand);
    starterCat.suggestBrand(shingle.brand);
    underlaymentCat.suggestBrand(shingle.brand);
    leakBarrierCat.suggestBrand(shingle.brand);
    ridgeVentCat.suggestBrand(shingle.brand);
  }
  onShingleChanged();

  function applyWarningState(cat, shingleBrand) {
    if (!cat.warningId) return;
    const warningEl = $(cat.warningId);
    const selected = cat.getSelected();
    if (!selected) { warningEl.classList.remove('is-visible'); return; }
    const mismatched = selected.brand !== shingleBrand && selected.brand !== 'House Brand';
    if (mismatched && STRICT_WARRANTY_BRANDS.has(shingleBrand)) {
      const domain = BRAND_WARNING_DOMAINS[shingleBrand];
      warningEl.innerHTML = `&#9888; This is a different brand than your ${shingleBrand} shingles. Mixing brands may affect eligibility for ${shingleBrand}'s enhanced system warranty. <a href="${domain}" target="_blank" rel="noopener">Learn more from ${shingleBrand} &rarr;</a>`;
      warningEl.classList.add('is-visible');
    } else {
      warningEl.classList.remove('is-visible');
    }
  }

  // ---- Add-ons: simple product selects (no brand grouping) ----
  const coilNailProducts = catalog.nails.filter((n) => n.name.startsWith('Roofing Coil'));
  fillSelect($('coilnails-product'), coilNailProducts, { valueFn: (item) => catalog.nails.indexOf(item) });
  fillSelect($('dripedge-product'), catalog.dripEdge, { valueFn: (item) => catalog.dripEdge.indexOf(item) });
  fillSelect($('valleymetal-product'), catalog.valleyFlashingMetal, { valueFn: (item) => catalog.valleyFlashingMetal.indexOf(item) });
  fillSelect($('decking-product'), catalog.decking, { valueFn: (item) => catalog.decking.indexOf(item) });

  const capNailProduct = catalog.nails.find((n) => n.name.startsWith('Cap Nails'));
  $('capnails-name').textContent = capNailProduct.name;

  // ---- Dynamic qty-chip lists (static vents, flashing accessories) ----
  function renderQtyList(container, items) {
    container.innerHTML = items.map((item, i) => `
      <div class="qty-chip">
        <span class="text-softwhite/80 text-sm">${item.name}</span>
        <input type="number" min="0" step="1" value="0" data-idx="${i}" class="qty-input">
      </div>
    `).join('');
  }
  renderQtyList($('static-vent-list'), catalog.ventilationStatic);
  renderQtyList($('flashing-accessory-list'), catalog.flashingAccessories);
  renderQtyList($('flatroof-list'), catalog.flatRoof);
  renderQtyList($('addons-list'), catalog.addOns);

  // ---- Build input object + recalc ----
  function buildInput() {
    const shingleIdx = Number($('shingle-product').value);
    const shingle = catalog.shingles[shingleIdx] || null;

    const staticVents = [...document.querySelectorAll('#static-vent-list .qty-input')]
      .map((el) => ({ product: catalog.ventilationStatic[Number(el.dataset.idx)], qty: Number(el.value) || 0 }))
      .filter((s) => s.qty > 0);
    const flashingAccessories = [...document.querySelectorAll('#flashing-accessory-list .qty-input')]
      .map((el) => ({ product: catalog.flashingAccessories[Number(el.dataset.idx)], qty: Number(el.value) || 0 }))
      .filter((s) => s.qty > 0);
    const flatRoofItems = [...document.querySelectorAll('#flatroof-list .qty-input')]
      .map((el) => ({ product: catalog.flatRoof[Number(el.dataset.idx)], qty: Number(el.value) || 0 }))
      .filter((s) => s.qty > 0);
    const addOnItems = [...document.querySelectorAll('#addons-list .qty-input')]
      .map((el) => ({ product: catalog.addOns[Number(el.dataset.idx)], qty: Number(el.value) || 0 }))
      .filter((s) => s.qty > 0);

    return {
      squares: Number($('squares').value) || 0,
      shingle,
      hipRidge: hipRidgeCat.getSelected(), hipRidgeQty: Number($('hipridge-qty').value) || 0,
      starter: starterCat.getSelected(), starterQty: Number($('starter-qty').value) || 0,
      underlayment: underlaymentCat.getSelected(), underlaymentQty: Number($('underlayment-qty').value) || 0,
      leakBarrier: leakBarrierCat.getSelected(), leakBarrierQty: Number($('leakbarrier-qty').value) || 0,
      coilNails: coilNailProducts[Number($('coilnails-product').value)] || null,
      coilNailsQty: Number($('coilnails-qty').value) || 0,
      capNails: capNailProduct, capNailsQty: Number($('capnails-qty').value) || 0,
      ridgeVent: ridgeVentCat.getSelected(), ridgeVentQty: Number($('ridgevent-qty').value) || 0,
      dripEdge: catalog.dripEdge[Number($('dripedge-product').value)] || null,
      dripEdgeQty: Number($('dripedge-qty').value) || 0,
      valleyMetal: catalog.valleyFlashingMetal[Number($('valleymetal-product').value)] || null,
      valleyMetalQty: Number($('valleymetal-qty').value) || 0,
      decking: catalog.decking[Number($('decking-product').value)] || null,
      deckingQty: Number($('decking-qty').value) || 0,
      staticVents, flashingAccessories, flatRoofItems, addOnItems,
      fulfillment: document.querySelector('input[name="fulfillment"]:checked').value,
    };
  }

  let lastResult = null;
  let lastInput = null;

  // Customer-facing summary: name + quantity ONLY. Never render li.cost or li.unitPrice here.
  function renderSummary(result) {
    const container = $('summary-line-items');
    if (!result.lineItems.length) {
      container.innerHTML = '<p class="empty-summary">Start with your shingle and squares to see your materials list.</p>';
    } else {
      container.innerHTML = result.lineItems.map((li) => `
        <div class="line-item">
          <span class="li-name">${li.label}</span>
          <span class="li-qty">${li.qty} ${li.unit}${li.qty === 1 ? '' : 's'}</span>
        </div>
      `).join('');
    }
    $('summary-fee-label').textContent = result.fulfillmentFee > 0 ? 'Delivery Fee' : 'Pickup';
    $('summary-fee').textContent = money(result.fulfillmentFee);
    $('summary-total').textContent = money(result.total);
  }

  function recalc() {
    const input = buildInput();
    lastInput = input;

    if (input.shingle) {
      applyWarningState(hipRidgeCat, input.shingle.brand);
      applyWarningState(starterCat, input.shingle.brand);
    }

    lastResult = window.EstimateEngine.buildEstimate(catalog, input);
    renderSummary(lastResult);
  }

  form.addEventListener('input', recalc);
  form.addEventListener('change', recalc);
  updateBundleReadout();
  recalc();

  // ---- Submission (Formspree, same pattern as contact.html) ----
  // The itemized breakdown WITH pricing goes to LG's inbox only — this is
  // for staff to confirm/fulfill the order, never rendered on screen.
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mlgyvdvn';

  function buildStaffSummaryText(result, input) {
    const lines = result.lineItems.map((li) =>
      `${li.confidence !== 'confirmed' ? '[VERIFY] ' : ''}${li.label} — ${li.qty} ${li.unit}(s) x ${money(li.unitPrice)} = ${money(li.cost)}`
    );
    lines.push('---');
    lines.push(`Materials Subtotal: ${money(result.materialsSubtotal)}`);
    lines.push(`${input.fulfillment === 'delivery' ? 'Delivery Fee' : 'Pickup'}: ${money(result.fulfillmentFee)}`);
    lines.push(`TOTAL: ${money(result.total)}`);
    return lines.join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const status = $('form-status');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const input = lastInput || buildInput();
    const result = lastResult || window.EstimateEngine.buildEstimate(catalog, input);

    const payload = new FormData();
    payload.append('_subject', 'New Estimate Request — LG Roofing Materials');
    payload.append('name', $('est-name').value);
    payload.append('phone', $('est-phone').value);
    payload.append('email', $('est-email').value);
    payload.append('address', $('est-address').value);
    payload.append('notes', $('est-notes').value);
    payload.append('fulfillment', input.fulfillment);
    payload.append('estimate_total', money(result.total));
    payload.append('estimate_breakdown', buildStaffSummaryText(result, input));

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        form.reset();
        status.textContent = `Thanks — your estimate request has been sent. ${catalog.meta.confirmationSla}`;
        status.className = 'mt-4 text-sm font-medium text-[#DBA44C]';
      } else {
        throw new Error('Form submission failed');
      }
    } catch (err) {
      status.textContent = 'Something went wrong sending your estimate. Please call us at (832) 430-0148 instead.';
      status.className = 'mt-4 text-sm font-medium text-red-400';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Estimate Request';
    }
  });
});
