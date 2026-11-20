// Vice Cover Studio — the cover engine.
// Draws GTA 6-style poster art on any 2D canvas: a multi-panel photo grid with
// white gutters, a Vice City sunset / neon grade per panel, comic halftone inking,
// and bold condensed title lettering with a neon script subtitle.
// Everything is drawn from `state` and `photos` at the canvas's own size, so the
// same function renders the live preview and the full-resolution export.

export const LAYOUTS = {
  hero: { label: 'Hero + three', panels: 4 },
  grid: { label: 'Four panel grid', panels: 4 },
  full: { label: 'Full bleed', panels: 1 },
  collage: { label: 'Nine panel collage', panels: 9 },
};

export const GRADES = {
  sunset: { label: 'Vice Sunset' },
  neon: { label: 'Neon Nights' },
  duotone: { label: 'Palm Duotone' },
  comic: { label: 'Comic Ink' },
  golden: { label: 'Golden Hour' },
};

export const TITLE_STYLES = {
  white: { label: 'White' },
  sunset: { label: 'Sunset gradient' },
  neon: { label: 'Neon pink' },
};

export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

/** Panels and the title zone for a layout, in fractions of the cover size. */
export function layoutPanels(layout, w, h) {
  const g = Math.max(4, Math.round(w * 0.012)); // gutter
  const f = Math.max(6, Math.round(w * 0.016)); // outer frame
  const x0 = f;
  const y0 = f;
  const cw = w - f * 2;
  const titleH = layout === 'full' ? 0 : Math.round(h * (layout === 'collage' ? 0.15 : 0.17));
  const ch = h - f * 2 - titleH;
  const panels = [];
  if (layout === 'hero') {
    const heroH = Math.round(ch * 0.6);
    const rowH = ch - heroH - g;
    const rowW = Math.floor((cw - g * 2) / 3);
    panels.push({ x: x0, y: y0, w: cw, h: heroH });
    for (let i = 0; i < 3; i++) {
      panels.push({ x: x0 + i * (rowW + g), y: y0 + heroH + g, w: rowW, h: rowH });
    }
  } else if (layout === 'grid') {
    const pw = Math.floor((cw - g) / 2);
    const ph = Math.floor((ch - g) / 2);
    panels.push({ x: x0, y: y0, w: pw, h: ph });
    panels.push({ x: x0 + pw + g, y: y0, w: pw, h: ph });
    panels.push({ x: x0, y: y0 + ph + g, w: pw, h: ph });
    panels.push({ x: x0 + pw + g, y: y0 + ph + g, w: pw, h: ph });
  } else if (layout === 'full') {
    panels.push({ x: x0, y: y0, w: cw, h: ch });
  } else {
    // collage: 3 x 3
    const pw = Math.floor((cw - g * 2) / 3);
    const ph = Math.floor((ch - g * 2) / 3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({ x: x0 + c * (pw + g), y: y0 + r * (ph + g), w: pw, h: ph });
      }
    }
  }
  const title = { x: x0, y: y0 + ch, w: cw, h: titleH };
  return { panels, title, gutter: g, frame: f };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Grade one panel's pixels in place. `data` is a Uint8ClampedArray (RGBA). */
export function gradePixels(data, grade) {
  const n = data.length;
  if (grade === 'sunset') {
    for (let i = 0; i < n; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // warm S-curve: lift the reds, pull the blues, add contrast
      data[i] = clamp(((r - 128) * 1.12 + 128) * 1.07 + 10, 0, 255);
      data[i + 1] = clamp(((g - 128) * 1.1 + 128) * 0.97, 0, 255);
      data[i + 2] = clamp(((b - 128) * 1.08 + 128) * 0.86, 0, 255);
    }
  } else if (grade === 'golden') {
    for (let i = 0; i < n; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      data[i] = clamp(r * 1.1 + 14, 0, 255);
      data[i + 1] = clamp(g * 1.02 + 6, 0, 255);
      data[i + 2] = clamp(b * 0.88, 0, 255);
    }
  } else if (grade === 'neon') {
    for (let i = 0; i < n; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      // teal shadows, magenta highlights, extra saturation
      const sat = 1.35;
      const avg = (r + g + b) / 3;
      let nr = clamp(avg + (r - avg) * sat, 0, 255);
      let ng = clamp(avg + (g - avg) * sat, 0, 255);
      let nb = clamp(avg + (b - avg) * sat, 0, 255);
      const shadow = 1 - lum;
      nr = nr * (1 - shadow * 0.35) + 10 * shadow * 0.35;
      ng = ng * (1 - shadow * 0.25) + 190 * shadow * 0.25;
      nb = nb * (1 - shadow * 0.25) + 200 * shadow * 0.25;
      const hi = lum * lum;
      nr = nr * (1 - hi * 0.4) + 255 * hi * 0.4;
      ng = ng * (1 - hi * 0.3) + 70 * hi * 0.3;
      nb = nb * (1 - hi * 0.3) + 170 * hi * 0.3;
      data[i] = clamp(nr, 0, 255);
      data[i + 1] = clamp(ng, 0, 255);
      data[i + 2] = clamp(nb, 0, 255);
    }
  } else if (grade === 'duotone') {
    for (let i = 0; i < n; i += 4) {
      const lum = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
      // deep teal shadows -> warm amber highlights
      const t = lum * lum * (3 - 2 * lum); // smoothstep
      data[i] = clamp(6 + (255 - 6) * t, 0, 255);
      data[i + 1] = clamp(42 + (179 - 42) * t, 0, 255);
      data[i + 2] = clamp(51 + (71 - 51) * t, 0, 255);
    }
  } else if (grade === 'comic') {
    // posterize to 6 levels, then boost contrast and saturation
    const levels = 6;
    const step = 255 / (levels - 1);
    for (let i = 0; i < n; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      const sat = 1.25;
      data[i] = clamp(Math.round((avg + (r - avg) * sat) / step) * step, 0, 255);
      data[i + 1] = clamp(Math.round((avg + (g - avg) * sat) / step) * step, 0, 255);
      data[i + 2] = clamp(Math.round((avg + (b - avg) * sat) / step) * step, 0, 255);
    }
  }
}

/** Draws halftone ink dots over a graded panel, from its pixel data. */
function drawHalftone(ctx, rect, data, pw, ph) {
  const cell = Math.max(5, Math.round(rect.w / 110));
  ctx.save();
  ctx.fillStyle = 'rgba(12, 6, 24, 0.5)';
  for (let gy = 0; gy < ph; gy += cell) {
    for (let gx = 0; gx < pw; gx += cell) {
      // sample the centre of the cell
      const sx = Math.min(pw - 1, gx + (cell >> 1));
      const sy = Math.min(ph - 1, gy + (cell >> 1));
      const idx = (sy * pw + sx) * 4;
      const lum = (data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11) / 255;
      const radius = (1 - lum) * cell * 0.42;
      if (radius < 0.4) continue;
      ctx.beginPath();
      ctx.arc(rect.x + gx + cell / 2, rect.y + gy + cell / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

let grainTile = null;
/** A small reusable film-grain tile, generated once. */
function getGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

/** Fits a title to the zone width, returning the font size in px. */
function fitTitle(ctx, text, maxWidth, startSize, fontFamily) {
  let size = startSize;
  ctx.font = `${size}px ${fontFamily}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${fontFamily}`;
  }
  return size;
}

/** Draws the title block: band, title in Anton, script subtitle in Pacifico. */
function drawTitleBlock(ctx, zone, state, w, h) {
  const { title, subtitle, titleStyle } = state;
  if (zone.h <= 0) return;
  const pad = Math.max(10, Math.round(w * 0.02));
  // dark plum band with a neon top rule
  ctx.fillStyle = '#160a24';
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  const rule = ctx.createLinearGradient(zone.x, 0, zone.x + zone.w, 0);
  rule.addColorStop(0, '#ff2e88');
  rule.addColorStop(0.5, '#ff9a3d');
  rule.addColorStop(1, '#19e3d6');
  ctx.fillStyle = rule;
  ctx.fillRect(zone.x, zone.y, zone.w, Math.max(3, Math.round(h * 0.004)));
  const text = (title || '').trim().toUpperCase();
  if (!text) return;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const size = fitTitle(ctx, text, zone.w - pad * 2, zone.h * 0.62, 'Anton, sans-serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (titleStyle === 'sunset') {
    const grad = ctx.createLinearGradient(zone.x, cy - size / 2, zone.x + zone.w, cy + size / 2);
    grad.addColorStop(0, '#ff5e8a');
    grad.addColorStop(0.5, '#ffb347');
    grad.addColorStop(1, '#ffe259');
    ctx.fillStyle = grad;
  } else if (titleStyle === 'neon') {
    ctx.fillStyle = '#ff2e88';
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.shadowColor = titleStyle === 'neon' ? 'rgba(25, 227, 214, 0.9)' : 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetX = titleStyle === 'neon' ? size * 0.05 : 0;
  ctx.shadowOffsetY = size * 0.06;
  ctx.strokeStyle = 'rgba(10, 4, 20, 0.85)';
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeText(text, cx, cy + size * 0.04);
  ctx.fillText(text, cx, cy + size * 0.04);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  // script subtitle, tucked over the title's upper right
  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(12, size * 0.34);
    ctx.font = `${subSize}px Pacifico, cursive`;
    const tw = ctx.measureText(text).width;
    const sx = cx + tw / 2 - ctx.measureText(sub).width * 0.25;
    const sy = cy - size * 0.52;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#7df9ff';
    ctx.shadowColor = 'rgba(255, 46, 136, 0.8)';
    ctx.shadowBlur = subSize * 0.3;
    ctx.fillText(sub, 0, 0);
    ctx.restore();
  }
}

/** Draws the small "VICE CITY" chip in the top corner of the cover. */
function drawBadge(ctx, w, h, frame) {
  const label = 'VICE CITY';
  const size = Math.max(11, Math.round(h * 0.016));
  ctx.font = `${size}px Anton, sans-serif`;
  const tw = ctx.measureText(label).width;
  const padX = size * 0.9;
  const padY = size * 0.55;
  const bw = tw + padX * 2;
  const bh = size + padY * 2;
  const bx = w - frame - bw - Math.max(8, w * 0.01);
  const by = frame + Math.max(8, h * 0.01);
  ctx.save();
  ctx.fillStyle = 'rgba(22, 10, 36, 0.82)';
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe259';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + size * 0.05);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws the whole cover onto `canvas` at its own pixel size.
 * `state`: { layout, grade, title, subtitle, titleStyle, frame, badge, panels }
 * `panels`: [{ photo, zoom, ox, oy }] — one per layout slot.
 * `photos`: array of HTMLImageElement (or null) the panels index into.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const { panels, title, frame } = layoutPanels(state.layout, w, h);
  // warm off-white poster board shows through the gutters
  ctx.fillStyle = state.frame ? '#f7f1e6' : '#160a24';
  ctx.fillRect(0, 0, w, h);
  const slots = state.panels || [];
  panels.forEach((rect, i) => {
    const slot = slots[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = photos[slot.photo] || null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      const zoom = clamp(slot.zoom || 1, 1, 3);
      const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const maxOx = Math.max(0, (dw - rect.w) / 2 / rect.w);
      const maxOy = Math.max(0, (dh - rect.h) / 2 / rect.h);
      const ox = clamp(slot.ox || 0, -maxOx, maxOx);
      const oy = clamp(slot.oy || 0, -maxOy, maxOy);
      ctx.drawImage(
        img,
        rect.x + (rect.w - dw) / 2 + ox * rect.w,
        rect.y + (rect.h - dh) / 2 + oy * rect.h,
        dw,
        dh,
      );
    } else {
      // empty panel: sunset placeholder gradient
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, '#ff5e8a');
      g.addColorStop(0.55, '#ff9a3d');
      g.addColorStop(1, '#19e3d6');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    // grade the panel in place
    const imgData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    gradePixels(imgData.data, state.grade);
    ctx.putImageData(imgData, rect.x, rect.y);
    if (state.grade === 'comic') drawHalftone(ctx, rect, imgData.data, rect.w, rect.h);
    // thin ink edge around the panel
    ctx.strokeStyle = 'rgba(12, 6, 24, 0.55)';
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  // full-bleed layout: title over a scrim at the foot of the photo
  if (state.layout === 'full') {
    const scrimH = Math.round(h * 0.24);
    const scrim = ctx.createLinearGradient(0, h - scrimH, 0, h);
    scrim.addColorStop(0, 'rgba(22, 10, 36, 0)');
    scrim.addColorStop(1, 'rgba(22, 10, 36, 0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(frame, h - scrimH - frame, w - frame * 2, scrimH);
    const rule = ctx.createLinearGradient(frame, 0, w - frame, 0);
    rule.addColorStop(0, '#ff2e88');
    rule.addColorStop(0.5, '#ff9a3d');
    rule.addColorStop(1, '#19e3d6');
    ctx.fillStyle = rule;
    ctx.fillRect(frame, h - scrimH - frame, w - frame * 2, Math.max(3, Math.round(h * 0.004)));
    drawTitleBlock(ctx, { x: frame, y: h - scrimH - frame, w: w - frame * 2, h: scrimH }, state, w, h);
  } else {
    drawTitleBlock(ctx, title, state, w, h);
  }
  if (state.badge !== false) drawBadge(ctx, w, h, frame);
  // grain + vignette finish
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(20, 0, 30, 0)');
  vig.addColorStop(1, 'rgba(20, 0, 30, 0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Renders a cover at full export size and returns the canvas. */
export function renderCover(width, height, state, photos) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state, photos);
  return canvas;
}
