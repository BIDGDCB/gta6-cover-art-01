// Vice Cover Studio — hand-in entrypoint (Node 22, standard library only).
//
// The studio itself lives in app/ (a static, offline cover-art maker) and its
// renders live in screenshots/. This script is the glue that turns that folder
// into a make.fun entry: it checks the entry is well formed, copies both
// folders into the output directory, and asks the vendored make.fun library
// to write the dossier the judge reads. It also leaves a small inventory
// (inventory.json) next to the dossier, describing what the studio offers.
//
// Run it from anywhere in the repo with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Without MAKEFUN_OUTPUT_DIR it writes straight to /output, which is where
// the grader expects the entry to land.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// ---------------------------------------------------------------------------
// Limits the bounty sets for an entry. These mirror the scorer's own caps,
// so anything that passes here also passes there; anything that fails here
// is rejected early with a message that names the offending file.
// ---------------------------------------------------------------------------
const LIMITS = {
  shotCountMin: 3,
  shotCountMax: 4,
  shotMaxBytes: 262144, // 256 KiB per screenshot
  appPathMaxBytes: 1000,
  dossierTextMaxBytes: 163840,
  dossierAppMaxFiles: 993,
  dossierAppMaxBytes: 50331648, // 48 MiB of app files in total
} as const;

const SHOT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

// Where this script lives, and where the entry goes.
const SOURCE_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_ROOT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A single error type so every validation failure reads the same way:
// "entrypoint: <what is wrong> (<which file>)".
class EntryProblem extends Error {
  constructor(message: string) {
    super(`entrypoint: ${message}`);
    this.name = 'EntryProblem';
  }
}

// ---------------------------------------------------------------------------
// Walking the app tree
// ---------------------------------------------------------------------------

type FileRecord = { rel: string; bytes: number };

function walkFiles(dir: string, base: string, out: FileRecord[] = []): FileRecord[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, base, out);
    } else if (entry.isFile()) {
      out.push({ rel: relative(base, full).split(sep).join('/'), bytes: statSync(full).size });
    }
  }
  return out;
}

function checkAppTree(appDir: string): FileRecord[] {
  const index = join(appDir, 'index.html');
  if (!existsSync(index)) {
    throw new EntryProblem(`app/index.html is missing — the entry needs a page to load (${appDir})`);
  }
  if (!statSync(index).isFile()) {
    throw new EntryProblem(`app/index.html is not a file (${index})`);
  }
  const files = walkFiles(appDir, appDir);
  for (const file of files) {
    const pathBytes = Buffer.byteLength(`app/${file.rel}`, 'utf8');
    if (pathBytes > LIMITS.appPathMaxBytes) {
      throw new EntryProblem(
        `app/${file.rel} has a path of ${pathBytes} bytes, over the ${LIMITS.appPathMaxBytes}-byte limit`,
      );
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Screenshots: magic bytes and dimensions straight from each file's header
// ---------------------------------------------------------------------------

type ShotInfo = { name: string; format: 'png' | 'jpeg'; width: number; height: number; bytes: number };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

function pngSize(head: Buffer): { width: number; height: number } {
  // Width and height sit at fixed offsets in the IHDR chunk, big-endian.
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

function jpegSize(head: Buffer): { width: number; height: number } {
  // Walk the marker segments until a start-of-frame marker (SOF0/SOF1/SOF2)
  // gives the dimensions; every other segment is skipped by its length.
  let cursor = 2;
  while (cursor + 9 < head.length) {
    if (head[cursor] !== 0xff) throw new EntryProblem('JPEG header is malformed (expected a marker)');
    const marker = head[cursor + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      cursor += 2; // standalone markers carry no length field
      continue;
    }
    const segmentLength = head.readUInt16BE(cursor + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: head.readUInt16BE(cursor + 5), width: head.readUInt16BE(cursor + 7) };
    }
    cursor += 2 + segmentLength;
  }
  throw new EntryProblem('JPEG has no start-of-frame segment, so its size cannot be read');
}

function inspectShot(filePath: string, name: string): ShotInfo {
  const bytes = statSync(filePath).size;
  if (bytes > LIMITS.shotMaxBytes) {
    throw new EntryProblem(`screenshots/${name} is ${bytes} bytes, over the ${LIMITS.shotMaxBytes}-byte cap`);
  }
  const head = readFileSync(filePath).subarray(0, 65536);
  if (head.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const { width, height } = pngSize(head);
    return { name, format: 'png', width, height, bytes };
  }
  if (head.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    const { width, height } = jpegSize(head);
    return { name, format: 'jpeg', width, height, bytes };
  }
  throw new EntryProblem(`screenshots/${name} is neither a PNG nor a JPEG (magic bytes do not match)`);
}

function checkShots(shotsDir: string): ShotInfo[] {
  if (!existsSync(shotsDir)) {
    throw new EntryProblem(`screenshots/ is missing — the entry needs ${LIMITS.shotCountMin} to ${LIMITS.shotCountMax} renders (${shotsDir})`);
  }
  const names = readdirSync(shotsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  if (names.length < LIMITS.shotCountMin || names.length > LIMITS.shotCountMax) {
    throw new EntryProblem(
      `screenshots/ holds ${names.length} file(s) (${names.join(', ') || 'none'}), but the entry needs ${LIMITS.shotCountMin} to ${LIMITS.shotCountMax}`,
    );
  }
  const shots = names.map((name) => {
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0 || !SHOT_EXTENSIONS.has(lower.slice(dot))) {
      throw new EntryProblem(`screenshots/${name} does not end in .png, .jpg or .jpeg`);
    }
    return inspectShot(join(shotsDir, name), name);
  });
  return shots;
}

// ---------------------------------------------------------------------------
// Inventory: what the studio actually offers, read from its own source
// ---------------------------------------------------------------------------

// Counts the top-level keys of one `export const NAME = { ... }` table in a
// source file, by walking the braces so nested objects do not leak keys in.
function countTableKeys(source: string, tableName: string): number | null {
  const head = source.match(new RegExp(`export const ${tableName} = \\{`));
  if (head === null || head.index === undefined) return null;
  let depth = 0;
  let keys = 0;
  let i = head.index + head[0].length - 1; // sit on the opening brace
  let atLineStart = true;
  for (; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && atLineStart && /[A-Za-z_$]/.test(ch)) {
      // A key at the table's own level: `name:` at the start of a line.
      const rest = source.slice(i);
      if (/^[A-Za-z_$][\w$]*\s*:/.test(rest)) keys++;
    }
    // Still "at the start of a line" after a newline or leading whitespace;
    // any other character ends it.
    atLineStart = ch === '\n' ? true : atLineStart && /\s/.test(ch);
  }
  return depth === 0 ? keys : null;
}

function inventoryApp(appDir: string, files: FileRecord[]) {
  const byExtension: Record<string, number> = {};
  for (const file of files) {
    const dot = file.rel.lastIndexOf('.');
    const ext = dot >= 0 ? file.rel.slice(dot) : '(none)';
    byExtension[ext] = (byExtension[ext] ?? 0) + 1;
  }
  // The studio's feature tables live in app/src/*.js: LAYOUTS (cover
  // arrangements), GRADES (colour grades), TITLE_STYLES and SIZES.
  const tables: Record<string, number> = {};
  const srcDir = join(appDir, 'src');
  if (existsSync(srcDir)) {
    for (const name of readdirSync(srcDir).filter((n) => n.endsWith('.js'))) {
      const source = readFileSync(join(srcDir, name), 'utf8');
      for (const table of ['LAYOUTS', 'GRADES', 'TITLE_STYLES', 'SIZES']) {
        const count = countTableKeys(source, table);
        if (count !== null) tables[table] = count;
      }
    }
  }
  return {
    appFiles: files.length,
    appBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    appFilesByExtension: byExtension,
    featureTables: tables,
  };
}

// ---------------------------------------------------------------------------
// Hand-in
// ---------------------------------------------------------------------------

function main(): void {
  const appDir = join(SOURCE_ROOT, 'app');
  const shotsDir = join(SOURCE_ROOT, 'screenshots');

  // Validate before copying anything, so a broken entry fails loudly here
  // instead of handing the judge a half-copied folder.
  const appFiles = checkAppTree(appDir);
  const shots = checkShots(shotsDir);
  const stock = inventoryApp(appDir, appFiles);

  mkdirSync(OUTPUT_ROOT, { recursive: true });
  cpSync(appDir, join(OUTPUT_ROOT, 'app'), { recursive: true });
  mkdirSync(join(OUTPUT_ROOT, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(OUTPUT_ROOT, 'screenshots'), { recursive: true });

  // The dossier itself is exactly what the vendored library writes — the
  // scorer re-derives it, so nothing extra may be added to this file.
  const dossier = buildDossier(OUTPUT_ROOT, {
    text_max_bytes: LIMITS.dossierTextMaxBytes,
    screenshots: { max: LIMITS.shotCountMax, max_bytes: LIMITS.shotMaxBytes },
    app_max_files: LIMITS.dossierAppMaxFiles,
    app_max_bytes: LIMITS.dossierAppMaxBytes,
    app_path_max_bytes: LIMITS.appPathMaxBytes,
  });
  writeFileSync(join(OUTPUT_ROOT, 'dossier.json'), dossier);

  // The inventory lives beside the dossier, in its own file.
  const inventory = {
    entry: 'gta6-cover-art-01',
    app: 'Vice Cover Studio',
    generatedBy: 'main.ts',
    layouts: stock.featureTables.LAYOUTS ?? null,
    colourGrades: stock.featureTables.GRADES ?? null,
    titleStyles: stock.featureTables.TITLE_STYLES ?? null,
    exportSizes: stock.featureTables.SIZES ?? null,
    appFiles: stock.appFiles,
    appBytes: stock.appBytes,
    appFilesByExtension: stock.appFilesByExtension,
    screenshots: shots,
  };
  writeFileSync(join(OUTPUT_ROOT, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);

  console.log(`handed in ${shots.length} screenshots to ${OUTPUT_ROOT}`);
  for (const shot of shots) {
    console.log(`  ${shot.name}: ${shot.format} ${shot.width}x${shot.height}, ${shot.bytes} bytes`);
  }
  console.log(
    `  app: ${stock.appFiles} files, ${stock.appBytes} bytes; ` +
      `layouts ${inventory.layouts ?? '?'}, grades ${inventory.colourGrades ?? '?'}, ` +
      `title styles ${inventory.titleStyles ?? '?'}, sizes ${inventory.exportSizes ?? '?'}`,
  );
}

try {
  main();
} catch (err) {
  if (err instanceof EntryProblem) {
    console.error(err.message);
    process.exitCode = 1;
  } else {
    throw err;
  }
}
