// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo;
// ?shot=cover shows the cover alone, full-bleed.
// Query params: photo (samples/<photo>.jpg), caption, subtitle, layout, grade,
// titleStyle, size. window.__shotReady is set once painted with fonts loaded.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const opts = {
    layout: query.get('layout') ?? undefined,
    grade: query.get('grade') ?? undefined,
    titleStyle: query.get('titleStyle') ?? undefined,
    size: query.get('size') ?? undefined,
    subtitle: query.get('subtitle') ?? undefined,
    offsets: query.get('offsets') ?? undefined,
  };
  await load(
    `samples/${query.get('photo') ?? 'pier'}.jpg`,
    query.get('caption') ?? 'Sunset Heist',
    opts,
  );
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('40px Anton'),
        document.fonts.load('40px Pacifico'),
        document.fonts.ready,
      ]);
    } catch { /* fall back to system fonts */ }
  }
  // one more paint at full resolution before the screenshot lands
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
