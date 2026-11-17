import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWad, identifyWad } from '../public/wad.js';

function buildIwad(lumpNames) {
  const lumps = lumpNames.map(() => new Uint8Array([0, 0, 0, 0]));
  const body = lumps.reduce((size, lump) => size + lump.length, 0);
  const out = Buffer.alloc(12 + body + lumpNames.length * 16);
  out.write('IWAD', 0, 'latin1');
  out.writeInt32LE(lumpNames.length, 4);
  out.writeInt32LE(12, 8);
  let offset = 12;
  for (let i = 0; i < lumps.length; i++) {
    out.set(lumps[i], offset);
    offset += lumps[i].length;
  }
  for (let i = 0; i < lumpNames.length; i++) {
    const entry = 12 + body + i * 16;
    out.writeInt32LE(12 + lumps.slice(0, i).reduce((size, lump) => size + lump.length, 0), entry);
    out.writeInt32LE(lumps[i].length, entry + 4);
    out.write(lumpNames[i].padEnd(8, '\0').slice(0, 8), entry + 8, 'latin1');
  }
  return new Uint8Array(out.buffer);
}
const maps = (prefix, count) => Array.from({length: count}, (_, i) => `${prefix}${String(i + 1).padStart(prefix === 'MAP' ? 2 : 1, '0')}`);

test('accepts the bundled real IWAD', () => {
  const bytes = readFileSync(new URL('../public/assets/doom1.wad', import.meta.url));
  assert.equal(validateWad(bytes), bytes);
});

test('names each known release from its level lumps', () => {
  const real = readFileSync(new URL('../public/assets/doom1.wad', import.meta.url));
  assert.equal(identifyWad(real), 'DOOM SHAREWARE');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...maps('E1M', 9)])), 'DOOM SHAREWARE');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...[1, 2, 3].flatMap((e) => maps(`E${e}M`, 9))])), 'DOOM');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...[1, 2, 3, 4].flatMap((e) => maps(`E${e}M`, 9))])), 'THE ULTIMATE DOOM');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...maps('MAP', 9)])), 'DOOM II SHAREWARE');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', 'TNT', ...maps('MAP', 32)])), 'TNT: EVILUTION');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', 'PLUT0', ...maps('MAP', 32)])), 'THE PLUTONIA EXPERIMENT');
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...maps('MAP', 36)])), 'DOOM II');
});

test('reports unknown IWAD contents so the file name can be shown instead', () => {
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...maps('E1M', 5)])), null);
  assert.equal(identifyWad(buildIwad(['PLAYPAL', ...maps('MAP', 16)])), null);
});
test('rejects truncated containers, PWADs and corrupt directory entries', () => {
  assert.throws(() => validateWad(new Uint8Array(4)), /too small/);
  const wad = readFileSync(new URL('../public/assets/doom1.wad', import.meta.url));
  const pwad = Buffer.from(wad); pwad.write('PWAD');
  assert.throws(() => validateWad(pwad), /IWAD/);
  assert.throws(() => validateWad(wad.subarray(0, 100)), /directory/);
  const corrupt = Buffer.from(wad);
  corrupt.writeInt32LE(-1, corrupt.readInt32LE(8));
  assert.throws(() => validateWad(corrupt), /invalid data/);
});
