// Basic container validation; the DOOM engine validates the game content.
export function validateWad(bytes) {
  if (bytes.byteLength < 12) throw new Error('This file is too small to be a WAD.');
  const names = wadLumpNames(bytes);
  if (!names.has('PLAYPAL') || (!names.has('E1M1') && !names.has('MAP01'))) throw new Error('This IWAD does not contain a supported DOOM game.');
  return bytes;
}

function wadLumpNames(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== 'IWAD') throw new Error('Choose a DOOM or DOOM II IWAD. Add-on PWADs need a base game and are not supported here.');
  const count = view.getInt32(4, true);
  const directory = view.getInt32(8, true);
  if (count < 1 || directory < 12 || directory + count * 16 > bytes.byteLength) throw new Error('The WAD directory is damaged or incomplete.');
  const names = new Set();
  for (let i = 0; i < count; i++) {
    const entry = directory + i * 16;
    const offset = view.getInt32(entry, true);
    const size = view.getInt32(entry + 4, true);
    if (offset < 0 || size < 0 || offset + size > bytes.byteLength) throw new Error('The WAD contains an invalid data entry.');
    names.add(String.fromCharCode(...bytes.subarray(entry + 8, entry + 16)).replace(/\0.*$/, ''));
  }
  return names;
}

// Names the loaded IWAD from its level lumps so the page can show which game it holds.
// Returns null when the contents match no known release; the caller then shows the file name.
export function identifyWad(bytes) {
  const names = wadLumpNames(bytes);
  const highest = (prefix) => Math.max(0, ...[...names]
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length))));
  if (names.has('E1M1')) {
    if (highest('E4M')) return 'THE ULTIMATE DOOM';
    if (highest('E2M') || highest('E3M')) return 'DOOM';
    return highest('E1M') === 9 ? 'DOOM SHAREWARE' : null;
  }
  const maps = highest('MAP');
  if (maps === 9) return 'DOOM II SHAREWARE';
  if (names.has('TNT')) return 'TNT: EVILUTION';
  if (names.has('PLUT0') || names.has('PLUT1')) return 'THE PLUTONIA EXPERIMENT';
  if (maps >= 35) return 'DOOM II';
  return null;
}
