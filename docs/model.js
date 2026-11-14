// Browser edition of the mathematical model. The native Idris theorem does
// not verify this JavaScript implementation; invariants are checked here.
export const CAPACITY = 64;
export const MAX_DEPTH = 6;

export function parseTree(source) {
  if (typeof source !== 'string' || !source.length || source.length > 127 || /[^BL]/.test(source))
    throw new Error('Invalid partition encoding.');
  let cursor = 0;
  function read(depth, id, start, width) {
    const token = source[cursor++];
    const node = { id, start, width, depth, children: null };
    if (token === 'L') return node;
    if (token !== 'B' || depth >= MAX_DEPTH) throw new Error('Invalid partition depth.');
    node.children = [read(depth + 1, id * 2, start, width / 2), read(depth + 1, id * 2 + 1, start + width / 2, width / 2)];
    return node;
  }
  const root = read(0, 1, 0, CAPACITY);
  if (cursor !== source.length) throw new Error('Unexpected partition data.');
  return root;
}

export function encode(node) { return node.children ? 'B' + node.children.map(encode).join('') : 'L'; }
export function leaves(node) { return node.children ? node.children.flatMap(leaves) : [node]; }

export function edit(source, action, target) {
  if (!['split', 'merge'].includes(action) || !Number.isInteger(target) || target < 1 || target > 127)
    throw new Error('Invalid edit.');
  const root = parseTree(source);
  let found = false;
  function visit(node) {
    if (node.id === target) {
      found = true;
      if (action === 'merge') return { ...node, children: null };
      if (node.children || node.depth >= MAX_DEPTH) throw new Error('This region is already at its smallest size.');
      const d = node.depth + 1, w = node.width / 2;
      return { ...node, children: [
        { id: node.id * 2, start: node.start, width: w, depth: d, children: null },
        { id: node.id * 2 + 1, start: node.start + w, width: w, depth: d, children: null }
      ] };
    }
    return node.children ? { ...node, children: node.children.map(visit) } : node;
  }
  const result = encode(visit(root));
  if (!found) throw new Error('That region is no longer present.');
  parseTree(result);
  return result;
}

export function relations(regions, focus) {
  if (!regions.some(r => r.id === focus)) throw new Error('Unknown focus region.');
  const touch = new Map(regions.map(r => [r.id, new Set()]));
  for (const a of regions) for (const b of regions)
    if (a.width === b.width && a.start + a.width === b.start) {
      touch.get(a.id).add(b.id); touch.get(b.id).add(a.id);
    }
  // Least fixed point of Reach(focus, focus) and Reach(x,z) :- Reach(x,y), Touch(y,z).
  const active = new Set([focus]);
  let changed;
  do {
    changed = false;
    for (const id of [...active]) for (const next of touch.get(id))
      if (!active.has(next)) { active.add(next); changed = true; }
  } while (changed);
  const selected = regions.find(r => r.id === focus);
  const mirror = regions.filter(r => r.width === selected.width && r.start + selected.start + r.width === CAPACITY).map(r => r.id);
  return { active: [...active].sort((a,b) => a-b), mirror };
}

export function field(regions, active) {
  const family = new Set(active);
  function sample(x) {
    return regions.reduce((sum, r) => {
      const phase = Math.floor((x + r.start * 3) * 64 / r.width) % 256;
      const pulse = Math.min(phase, 256 - phase);
      return sum + Math.floor((1 + Number(family.has(r.id))) * r.width * pulse / 2);
    }, 0);
  }
  function tree(depth, start, stride) {
    return depth === 0 ? [sample(start)] : [...tree(depth - 1, start, stride / 2), ...tree(depth - 1, start + stride, stride / 2)];
  }
  return tree(8, 0, 128);
}

export function compute(source, focus = 1) {
  const root = parseTree(source), regions = leaves(root);
  if (!regions.some(r => r.id === focus)) focus = regions[0].id;
  const mass = regions.reduce((sum, r) => sum + r.width, 0);
  if (mass !== CAPACITY) throw new Error('Conservation check failed.');
  const derived = relations(regions, focus), samples = field(regions, derived.active);
  if (samples.length !== 256 || samples.some(v => !Number.isInteger(v) || v < 0 || v > 8192))
    throw new Error('Field validation failed.');
  return { source, focus, regions, mass, samples, ...derived };
}
