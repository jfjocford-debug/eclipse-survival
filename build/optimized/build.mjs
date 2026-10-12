#!/usr/bin/env node
/** Reproducible static package. Run: node build/optimized/build.mjs */
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'build/optimized/site');
const directories = ['data', 'engine', 'ecs', 'render', 'assets', 'world', 'ai', 'workers', 'systems', 'ui', 'save', 'perf'];
const entryFiles = ['index.html', 'main.js', 'game.js'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

async function walk(folder) {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || e.name.endsWith('.md') || e.name.endsWith('.mjs') || e.name.endsWith('-results.json') || /\.test\.[cm]?js$/.test(e.name)) continue;
    const path = join(folder, e.name);
    if (e.isDirectory()) files.push(...await walk(path));
    else if (e.isFile()) files.push(path);
  }
  return files;
}

const sources = new Map();
for (const path of [...entryFiles.map(f => resolve(root, f)), ...(await Promise.all(directories.map(d => walk(resolve(root, d))))).flat()]) {
  sources.set(relative(root, path).split('\\').join('/'), await readFile(path));
}
// Validate module graph before replacing a previously usable package.
for (const match of sources.get('index.html').toString().matchAll(/(?:src|href)\s*=\s*['"]([^'"]+)['"]/g)) {
  const reference = match[1];
  if (/^(data:|#)/.test(reference)) continue;
  if (/^https?:|^\/\//.test(reference)) throw new Error(`External runtime resource in index.html: ${reference}`);
  const path = reference.replace(/^\.?\//, '').split(/[?#]/)[0];
  if (!sources.has(path)) throw new Error(`Missing HTML resource: ${reference}`);
}
for (const [name, data] of sources) {
  if (extname(name) !== '.js') continue;
  const specifiers = [...data.toString().matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|new\s+URL\s*\(\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
  for (const specifier of specifiers) {
    if (/^(https?:)?\/\//.test(specifier)) throw new Error(`External runtime dependency in ${name}: ${specifier}`);
    if (!specifier.startsWith('.')) continue;
    const target = relative(root, resolve(root, dirname(name), specifier)).split('\\').join('/');
    if (!sources.has(target)) throw new Error(`Missing module or worker: ${name} → ${specifier}`);
  }
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const manifest = { format: 1, files: {}, totals: { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 } };
for (const [name, data] of [...sources.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const dest = resolve(output, name);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, data);
  const entry = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), contentType: mime[extname(name)] || 'application/octet-stream' };
  if (compressible.has(extname(name))) {
    const gz = gzipSync(data, { level: 9 });
    const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
    await writeFile(dest + '.gz', gz);
    await writeFile(dest + '.br', br);
    entry.gzipBytes = gz.length;
    entry.brotliBytes = br.length;
  }
  manifest.files[name] = entry;
  manifest.totals.rawBytes += data.length;
  manifest.totals.gzipBytes += entry.gzipBytes ?? data.length;
  manifest.totals.brotliBytes += entry.brotliBytes ?? data.length;
}
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, files: sources.size, ...manifest.totals }, null, 2));
