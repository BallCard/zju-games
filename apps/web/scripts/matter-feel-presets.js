#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRESETS = {
  bouncy: {
    name: 'bouncy',
    label: 'Bouncy',
    description: 'Higher rebound, faster chain reactions, more arcade feel.',
    physics: {
      gravityY: 0.92,
      restitution: 0.22,
      friction: 0.01,
      frictionAir: 0.006,
      frictionStatic: 0.03,
      densityScale: 0.9
    }
  },
  balanced: {
    name: 'balanced',
    label: 'Balanced',
    description: 'Stable default profile with predictable control.',
    physics: {
      gravityY: 1.02,
      restitution: 0.1,
      friction: 0.018,
      frictionAir: 0.012,
      frictionStatic: 0.04,
      densityScale: 1.0
    }
  },
  heavy: {
    name: 'heavy',
    label: 'Heavy',
    description: 'Lower bounce and stronger gravity for weighty collisions.',
    physics: {
      gravityY: 1.12,
      restitution: 0.04,
      friction: 0.03,
      frictionAir: 0.02,
      frictionStatic: 0.06,
      densityScale: 1.2
    }
  }
};

const ORDER = ['bouncy', 'balanced', 'heavy'];
const STATE_FILE = resolve(process.cwd(), 'apps/web/scripts/matter-feel.active.json');

function readState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return typeof parsed?.preset === 'string' ? parsed.preset : null;
  } catch {
    return null;
  }
}

function writeState(name) {
  const payload = {
    preset: name,
    updatedAt: new Date().toISOString(),
    ...PRESETS[name]
  };
  writeFileSync(STATE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function parseArg(flag) {
  const direct = process.argv.find((x) => x.startsWith(`${flag}=`));
  if (direct) return direct.split('=')[1];
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return null;
}

function has(flag) {
  return process.argv.includes(flag);
}

function list() {
  for (const key of ORDER) {
    const p = PRESETS[key];
    console.log(`- ${p.name}: ${p.label} (${p.description})`);
  }
}

function resolvePreset() {
  const fromArg = parseArg('--preset') ?? parseArg('--set');
  if (fromArg && PRESETS[fromArg]) return fromArg;

  const current = readState();
  if (has('--next')) {
    const idx = Math.max(0, ORDER.indexOf(current ?? 'balanced'));
    return ORDER[(idx + 1) % ORDER.length];
  }
  if (has('--prev')) {
    const idx = Math.max(0, ORDER.indexOf(current ?? 'balanced'));
    return ORDER[(idx - 1 + ORDER.length) % ORDER.length];
  }

  if (current && PRESETS[current]) return current;
  return 'balanced';
}

function printHelp() {
  console.log(`Usage:
  node apps/web/scripts/matter-feel-presets.js --list
  node apps/web/scripts/matter-feel-presets.js --preset bouncy
  node apps/web/scripts/matter-feel-presets.js --next --write
  node apps/web/scripts/matter-feel-presets.js --preset heavy --export

Flags:
  --list      List presets
  --preset    Select preset (bouncy|balanced|heavy)
  --set       Alias of --preset
  --next      Cycle to next preset
  --prev      Cycle to previous preset
  --write     Persist to apps/web/scripts/matter-feel.active.json
  --export    Print JSON only
`);
}

if (has('--help') || has('-h')) {
  printHelp();
  process.exit(0);
}

if (has('--list')) {
  list();
  process.exit(0);
}

const presetName = resolvePreset();
const preset = PRESETS[presetName];
if (!preset) {
  console.error('Invalid preset. Use --list to see available presets.');
  process.exit(1);
}

if (has('--write')) {
  writeState(presetName);
}

if (has('--export')) {
  console.log(JSON.stringify(preset, null, 2));
  process.exit(0);
}

console.log(`Preset: ${preset.name} (${preset.label})`);
console.log(preset.description);
console.log(JSON.stringify(preset.physics, null, 2));
console.log(`State file: ${STATE_FILE}`);