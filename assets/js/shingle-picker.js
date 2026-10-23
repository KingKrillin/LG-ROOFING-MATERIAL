// Shingle line + color picker for the brand pages.
// Data comes from assets/js/shingle-lines.js (window.SHINGLE_LINES). The page
// loads this script with data-brand="<brand key>" and provides the markup ids
// used below (#sp-lines, #swatch-grid, #shingle-preview-*, #house-preview-*, #oc-lightbox).
// Deep links: ?line=<line id>&color=<color slug>

(() => {
  const script = document.currentScript;
  const BRAND = script.dataset.brand;
  const SITE_LABEL = script.dataset.site || 'the manufacturer site';
  const HOUSE_LABEL = script.dataset.houseLabel || 'On a Home';
  const lines = (window.SHINGLE_LINES || {})[BRAND] || [];
  if (!lines.length) return;

  const IMG_BASE = '../assets/images/shingles/';
  const $ = (id) => document.getElementById(id);
  const plain = (s) => s.replace(/[®™]/g, '');
  const html = (s) => s.replace(/®/g, '&reg;').replace(/™/g, '&trade;');

  const params = new URLSearchParams(location.search);
  let line = lines.find((l) => l.id === params.get('line')) || lines.find((l) => l.id === script.dataset.defaultLine) || lines[0];
  let color = null;

  // ---- Line tabs ----
  const tabs = $('sp-lines');
  lines.forEach((l) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-line-tab';
    btn.setAttribute('role', 'tab');
    btn.dataset.id = l.id;
    btn.innerHTML = `<span class="sp-line-tab__name">${html(l.name)}</span><span class="sp-line-tab__tier">${l.tier}</span>`;
    btn.addEventListener('click', () => selectLine(l.id));
    tabs.appendChild(btn);
  });

  function selectLine(id, colorSlug) {
    line = lines.find((l) => l.id === id) || lines[0];
    tabs.querySelectorAll('.sp-line-tab').forEach((t) => {
      const on = t.dataset.id === line.id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });

    const n = line.colors.length;
    $('sp-line-meta').innerHTML =
      `<span>${n} color${n === 1 ? '' : 's'} offered in the Houston area</span>` +
      (!line.stocked ? '<span class="sp-badge">Special Order</span>'
        : line.stockedColors ? `<span class="sp-badge sp-badge--stock">${line.colors.filter((c) => line.stockedColors.includes(c.slug)).map((c) => c.name).join(', ')} stocked at LG</span><span class="sp-badge">Other colors special order</span>`
        : '<span class="sp-badge sp-badge--stock">Stocked at LG</span>');

    renderSwatches();
    const more = $('sp-more-photos');
    if (more) { more.href = line.url; more.textContent = `See ${plain(line.name)} on ${SITE_LABEL}`; }
    selectColor(colorSlug && line.colors.some((c) => c.slug === colorSlug) ? colorSlug : line.colors[0].slug);
  }

  // ---- Swatches ----
  function renderSwatches() {
    const grid = $('swatch-grid');
    grid.innerHTML = '';
    grid.setAttribute('aria-label', `${plain(line.name)} shingle colors`);
    let lastGroup;
    const grouped = line.colors.some((c) => c.group);
    line.colors.forEach((c) => {
      const group = c.group || 'Core Colors';
      if (grouped && group !== lastGroup) {
        const label = document.createElement('div');
        label.className = 'sp-group-label';
        label.textContent = group === 'Regional' ? 'Regional Colors' : group;
        grid.appendChild(label);
        lastGroup = group;
      }
      const cell = document.createElement('div');
      cell.className = 'sp-swatch-cell';
      cell.setAttribute('role', 'listitem');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oc-swatch';
      btn.dataset.slug = c.slug;
      btn.setAttribute('aria-label', c.name);
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = `<img src="${IMG_BASE}${line.id}/${c.slug}-thumb.jpg" alt="${c.name} shingle swatch" loading="lazy">`;
      btn.addEventListener('click', () => selectColor(c.slug));
      cell.appendChild(btn);
      cell.insertAdjacentHTML('beforeend', `<span class="sp-swatch-name">${c.name}</span>`);
      grid.appendChild(cell);
    });
  }

  function loadInto(img, src, alt) {
    img.classList.add('is-loading');
    img.onload = () => img.classList.remove('is-loading');
    img.src = src;
    img.alt = alt;
  }

  // ---- Color selection ----
  function selectColor(slug) {
    color = line.colors.find((c) => c.slug === slug) || line.colors[0];
    const label = `${BRAND} ${plain(line.name)} ${color.name}`;

    $('color-name').textContent = color.name;
    const desc = $('color-desc');
    desc.textContent = color.desc || `${plain(line.name)} in ${color.name}.`;
    const badge = $('color-group');
    badge.hidden = !color.group;
    badge.textContent = color.group === 'Regional' ? 'Regional Color' : (color.group || '');

    loadInto($('shingle-preview-img'), `${IMG_BASE}${line.id}/${color.slug}-texture-md.jpg`, `${label} shingle close-up`);
    const houseImg = $('house-preview-img');
    $('house-preview-empty').hidden = color.house;
    houseImg.hidden = !color.house;
    $('house-zoom-btn').hidden = !color.house;
    if (color.house) loadInto(houseImg, `${IMG_BASE}${line.id}/${color.slug}-house-md.jpg`, `${label} shingles ${HOUSE_LABEL.toLowerCase()}`);

    document.querySelectorAll('#swatch-grid .oc-swatch').forEach((btn) => {
      const on = btn.dataset.slug === color.slug;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    const choose = $('sp-choose');
    if (choose) {
      const q = new URLSearchParams({ brand: BRAND, line: plain(line.name), color: color.name });
      if (line.stock) q.set('product', line.stock);
      choose.href = `../estimate.html?${q}`;
    }
    const mfr = $('sp-mfr-link');
    if (mfr) mfr.href = line.url;

    const url = new URL(location.href);
    url.searchParams.set('line', line.id);
    url.searchParams.set('color', color.slug);
    history.replaceState(null, '', url);
  }

  // ---- Lightbox ----
  function openLightbox(view) {
    if (!color || (view === 'house' && !color.house)) return;
    const img = $('lightbox-img');
    img.src = `${IMG_BASE}${line.id}/${color.slug}-${view}.jpg`;
    img.alt = `${BRAND} ${plain(line.name)} ${color.name} ${view === 'house' ? HOUSE_LABEL.toLowerCase() : 'shingle close-up'}`;
    $('lightbox-sub').innerHTML = `${color.name} &middot; ${BRAND} ${html(line.name)}`;
    $('oc-lightbox').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    $('oc-lightbox').classList.remove('is-open');
    document.body.style.overflow = '';
  }

  [['shingle-preview-trigger', 'zoom-btn', 'texture'], ['house-preview-trigger', 'house-zoom-btn', 'house']].forEach(([frameId, btnId, view]) => {
    const frame = $(frameId);
    frame.addEventListener('click', () => openLightbox(view));
    frame.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(view); }
    });
    $(btnId).addEventListener('click', (e) => { e.stopPropagation(); openLightbox(view); });
  });
  $('lightbox-close').addEventListener('click', closeLightbox);
  $('oc-lightbox').addEventListener('click', (e) => { if (e.target.id === 'oc-lightbox') closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  selectLine(line.id, params.get('color'));
})();
