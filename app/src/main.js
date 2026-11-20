// Vice Cover Studio — wires the editor page: photo uploads, panel picking,
// drag-to-crop and zoom, layout / grade / title controls, and PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, renderCover, LAYOUTS, GRADES, TITLE_STYLES, SIZES, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const strip = document.getElementById('strip');
const zoomSlider = document.getElementById('zoom');
const panelLabel = document.getElementById('panel-label');

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Vice City nights',
  titleStyle: 'sunset',
  frame: true,
  badge: true,
  size: 'wide',
  panels: [],
};
let photos = []; // HTMLImageElement per slot in the filmstrip
let selectedPanel = 0;
let dragging = null;

/** Keeps one slot per layout panel; never reassigns photos on its own. */
function syncPanels() {
  const count = LAYOUTS[state.layout].panels;
  while (state.panels.length < count) {
    state.panels.push({ photo: 0, zoom: 1, ox: 0, oy: 0 });
  }
  while (state.panels.length > count) state.panels.pop();
  state.panels.forEach((p) => {
    if (p.photo >= photos.length) p.photo = 0;
  });
  if (selectedPanel >= count) selectedPanel = 0;
}

/** (Re)builds the panel slots from the photos now loaded: panel i takes photo i. */
function initPanels() {
  const count = LAYOUTS[state.layout].panels;
  state.panels = [];
  for (let i = 0; i < count; i++) {
    state.panels.push({ photo: i % Math.max(1, photos.length), zoom: 1, ox: 0, oy: 0 });
  }
  selectedPanel = 0;
}

function previewScale() {
  // cover screenshots render at full export resolution; the editor previews small
  if (document.body.classList.contains('shot-cover')) return 1;
  const size = SIZES[state.size];
  return Math.min(1, 640 / Math.max(size.w, size.h));
}

function redraw() {
  syncPanels();
  const size = SIZES[state.size];
  const scale = previewScale();
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  drawCover(canvas, state, photos);
  panelLabel.textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  zoomSlider.value = String(Math.round((state.panels[selectedPanel]?.zoom ?? 1) * 100));
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Adds an image to the filmstrip and returns its index. */
function addPhoto(img, name) {
  const idx = photos.length;
  photos.push(img);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'thumb';
  btn.title = name || `Photo ${idx + 1}`;
  const thumb = document.createElement('canvas');
  thumb.width = 96;
  thumb.height = 96;
  const tctx = thumb.getContext('2d');
  const s = Math.max(96 / img.naturalWidth, 96 / img.naturalHeight);
  tctx.drawImage(img, (96 - img.naturalWidth * s) / 2, (96 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  btn.appendChild(thumb);
  btn.addEventListener('click', () => {
    state.panels[selectedPanel].photo = idx;
    redraw();
    setStatus(`Panel ${selectedPanel + 1} now uses photo ${idx + 1}.`);
  });
  strip.appendChild(btn);
  return idx;
}

function setStatus(text) {
  status.textContent = text;
}

/** Builds a radio-style button group inside `el` from a dict of options. */
const optionGroups = [];
function buildGroup(el, options, current, onPick, getCurrent) {
  el.innerHTML = '';
  const keys = Object.keys(options);
  for (const [key, def] of Object.entries(options)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (key === current ? ' on' : '');
    b.textContent = def.label;
    b.dataset.key = key;
    b.setAttribute('aria-pressed', key === current ? 'true' : 'false');
    b.addEventListener('click', () => {
      onPick(key);
      el.querySelectorAll('.opt').forEach((o) => o.classList.remove('on'));
      b.classList.add('on');
      redraw();
    });
    el.appendChild(b);
  }
  optionGroups.push({ el, keys, getCurrent });
}

/** Re-applies the highlighted option in every group from the current state. */
function syncOptionGroups() {
  for (const { el, getCurrent } of optionGroups) {
    const current = getCurrent();
    el.querySelectorAll('.opt').forEach((o) => {
      const on = o.dataset.key === current;
      o.classList.toggle('on', on);
      o.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
}

buildGroup(document.getElementById('layouts'), LAYOUTS, state.layout, (k) => { state.layout = k; initPanels(); }, () => state.layout);
buildGroup(document.getElementById('grades'), GRADES, state.grade, (k) => { state.grade = k; }, () => state.grade);
buildGroup(document.getElementById('title-styles'), TITLE_STYLES, state.titleStyle, (k) => { state.titleStyle = k; }, () => state.titleStyle);
buildGroup(document.getElementById('sizes'), SIZES, state.size, (k) => { state.size = k; }, () => state.size);

document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('frame').addEventListener('change', (e) => { state.frame = e.target.checked; redraw(); });
document.getElementById('badge').addEventListener('change', (e) => { state.badge = e.target.checked; redraw(); });
zoomSlider.addEventListener('input', () => {
  state.panels[selectedPanel].zoom = Number(zoomSlider.value) / 100;
  redraw();
});
document.getElementById('reset-panel').addEventListener('click', () => {
  state.panels[selectedPanel] = { photo: state.panels[selectedPanel].photo, zoom: 1, ox: 0, oy: 0 };
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const photo = state.panels[selectedPanel].photo;
  state.panels.forEach((p) => { p.photo = photo; });
  redraw();
  setStatus('All panels use the selected photo.');
});
document.getElementById('photo').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      addPhoto(img, file.name);
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  if (photos.length) {
    state.panels.forEach((p, i) => { if (p.photo >= photos.length) p.photo = 0; });
    redraw();
    setStatus(`${e.target.files.length} photo(s) added — click a panel, then a thumbnail to place it.`);
  }
  e.target.value = '';
});

/** Hit-tests the preview canvas: which panel is at canvas pixel (x, y)? */
function panelAt(x, y) {
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const i = panelAt(pt.x, pt.y);
  if (i < 0) return;
  selectedPanel = i;
  dragging = { x: pt.x, y: pt.y, ox: state.panels[i].ox, oy: state.panels[i].oy };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const pt = canvasPoint(e);
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = panels[selectedPanel];
  const slot = state.panels[selectedPanel];
  slot.ox = dragging.ox + (pt.x - dragging.x) / rect.w;
  slot.oy = dragging.oy + (pt.y - dragging.y) / rect.h;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = panelAt(...Object.values(canvasPoint(e)));
  if (i < 0) return;
  selectedPanel = i;
  const slot = state.panels[i];
  slot.zoom = Math.min(3, Math.max(1, slot.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  redraw();
}, { passive: false });

/** Exports the current cover at `sizeKey` (or all three sizes) as PNG files. */
function download(canvasEl, filename) {
  canvasEl.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function exportOne(sizeKey) {
  const size = SIZES[sizeKey];
  const out = renderCover(size.w, size.h, state, photos);
  download(out, `vice-cover-${size.w}x${size.h}.png`);
  return `${size.w}x${size.h}`;
}

document.getElementById('export').addEventListener('click', () => {
  const dims = exportOne(state.size);
  setStatus(`Saved vice-cover-${dims}.png — share it anywhere.`);
});
document.getElementById('export-all').addEventListener('click', () => {
  const dims = Object.keys(SIZES).map(exportOne);
  setStatus(`Saved ${dims.map((d) => `vice-cover-${d}.png`).join(', ')}.`);
});

// Sample photos ship with the app so it works the moment it opens.
async function loadSamples() {
  for (const name of ['pier', 'boulevard']) {
    try {
      addPhoto(await loadImage(`samples/${name}.jpg`), name);
    } catch {
      // samples are optional; uploads still work
    }
  }
  initPanels();
  redraw();
}

if (document.fonts) {
  Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('40px Pacifico'),
  ]).then(() => { if (photos.length) redraw(); }).catch(() => {});
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, async (sample, text, opts) => {
    if (opts.layout) state.layout = opts.layout;
    if (opts.grade) state.grade = opts.grade;
    if (opts.titleStyle) state.titleStyle = opts.titleStyle;
    if (opts.size) state.size = opts.size;
    if (opts.subtitle !== undefined) state.subtitle = opts.subtitle;
    state.title = text;
    document.getElementById('title').value = text;
    document.getElementById('subtitle').value = state.subtitle;
    photos = [];
    strip.innerHTML = '';
    addPhoto(await loadImage(sample), 'sample');
    // a second sample so multi-panel layouts show two different photos
    try {
      const other = sample.includes('pier') ? 'samples/boulevard.jpg' : 'samples/pier.jpg';
      addPhoto(await loadImage(other), 'sample 2');
    } catch { /* one photo is enough */ }
    initPanels();
    syncOptionGroups();
    redraw();
    // per-panel crop offsets from the query, "ox,oy;ox,oy;..." in panel order
    if (opts.offsets) {
      opts.offsets.split(';').forEach((pair, i) => {
        const [ox, oy] = pair.split(',').map(Number);
        if (state.panels[i] && Number.isFinite(ox) && Number.isFinite(oy)) {
          state.panels[i].ox = ox;
          state.panels[i].oy = oy;
        }
      });
      redraw();
    }
  });
} else {
  loadSamples();
}
