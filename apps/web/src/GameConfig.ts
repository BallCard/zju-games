import Phaser from 'phaser';
import MainScene from './MainScene';

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 711;

export const COMBO_WINDOW_MS = 800;
export const DROP_LEVEL_UNLOCK_SCORES = [
  0, 200, 600, 1200, 2200, 3600, 5400, 7600, 10200, 13200, 16800, 21000,
];

export const BASE_ELEMENT_DENSITY = 0.0015;
export const ELEMENT_DENSITY_DECAY_FACTOR = 0.88;

// instant is deprecated for gameplay and retained only for backward compatibility.
export type FailureMode = 'instant' | 'grace';
export const FAILURE_MODE: FailureMode = 'grace';
export const FAILURE_GRACE_MS = 2200;
export const FAILURE_CLEAR_MS = 450;
export const DANGER_LINE_RATIO = 0.3;
export const DANGER_LINE_TOP_MARGIN_PX = 8;

export type FeelPresetName = 'bouncy' | 'balanced' | 'heavy';
export type CatAssetKind = 'static' | 'animated-reserved';
export type CatArtPackId = 'meme-chaos-v1' | 'meme-chaos-v2' | 'legend-chaos-v1';

export interface MatterFeelPreset {
  gravityY: number;
  restitution: number;
  friction: number;
  frictionAir: number;
  frictionStatic: number;
  densityScale: number;
}

export interface CatVariantConfig {
  id: string;
  sourceFile: string;
  previewFile?: string;
  kind: CatAssetKind;
  weight?: number;
  spritesheetKey?: string;
  spritesheetFile?: string;
  animationKey?: string;
  displayRadiusOverride?: number;
  physicsRadiusOverride?: number;
  frameConfig?: {
    frameWidth: number;
    frameHeight: number;
    startFrame?: number;
    endFrame?: number;
    frameRate?: number;
    repeat?: number;
  };
}

export interface ZjuElementConfig {
  level: number;
  name: string;
  radius: number;
  score: number;
  defaultVariantId: string;
}

export interface CatArtPackConfig {
  id: CatArtPackId;
  label: string;
  levelVariants: Record<number, CatVariantConfig[]>;
}

export const FEEL_PRESETS: Record<FeelPresetName, MatterFeelPreset> = {
  bouncy: {
    gravityY: 0.95,
    restitution: 0.28,
    friction: 0.004,
    frictionAir: 0.001,
    frictionStatic: 0.005,
    densityScale: 0.85,
  },
  balanced: {
    gravityY: 1.02,
    restitution: 0.24,
    friction: 0.005,
    frictionAir: 0.001,
    frictionStatic: 0.006,
    densityScale: 1,
  },
  heavy: {
    gravityY: 1.1,
    restitution: 0.2,
    friction: 0.007,
    frictionAir: 0.0015,
    frictionStatic: 0.008,
    densityScale: 1.1,
  },
};

export const ZJU_ELEMENTS: ZjuElementConfig[] = [
  { level: 1, name: '抢课验证码', radius: 14, score: 12, defaultVariantId: 'cat-l1-core' },
  { level: 2, name: '选课转圈圈', radius: 17, score: 23, defaultVariantId: 'cat-l2-core' },
  { level: 3, name: '早八闹钟', radius: 21, score: 43, defaultVariantId: 'cat-l3-core' },
  { level: 4, name: '麦香饼', radius: 26, score: 81, defaultVariantId: 'cat-l4-core' },
  { level: 5, name: '大不列颠土豆', radius: 32, score: 152, defaultVariantId: 'cat-l5-core' },
  { level: 6, name: '小白车', radius: 40, score: 286, defaultVariantId: 'cat-l6-core' },
  { level: 7, name: '紫金港大白鹅', radius: 50, score: 538, defaultVariantId: 'cat-l7-core' },
  { level: 8, name: '启真湖晚风', radius: 62, score: 1011, defaultVariantId: 'cat-l8-core' },
  { level: 9, name: '图书馆满座提示', radius: 77, score: 1901, defaultVariantId: 'cat-l9-core' },
  { level: 10, name: '门禁倒计时', radius: 95, score: 3574, defaultVariantId: 'cat-l10-core' },
  { level: 11, name: '满绩传说（4.0/4.8）', radius: 111, score: 6719, defaultVariantId: 'cat-l11-core' },
  { level: 12, name: '竺院神仙', radius: 129, score: 12631, defaultVariantId: 'cat-l12-core' },
];

const buildCoreVariant = (level: number): CatVariantConfig => ({
  id: `cat-l${level}-core`,
  sourceFile: `cat-${level}.png`,
  kind: 'static',
  weight: level >= 8 ? 1.15 : 1,
});

const buildAssetVariant = (
  level: number,
  slot: number,
  sourceFile: string,
  packTag: string,
  weight = 1,
): CatVariantConfig => ({
  id: `cat-l${level}-${packTag}-${slot}`,
  sourceFile,
  kind: sourceFile.endsWith('.gif') ? 'animated-reserved' : 'static',
  weight,
});

const createLevelVariants = (
  level: number,
  packTag: string,
  sourceFiles: string[],
  baseWeight = 1,
): CatVariantConfig[] => [
  buildCoreVariant(level),
  ...sourceFiles.map((sourceFile, index) => buildAssetVariant(level, index + 1, sourceFile, packTag, Math.max(0.7, baseWeight - index * 0.04))),
];

export const DEFAULT_CAT_ART_PACK: CatArtPackId = 'meme-chaos-v1';

export const CAT_ART_PACKS: Record<CatArtPackId, CatArtPackConfig> = {
  'meme-chaos-v1': {
    id: 'meme-chaos-v1',
    label: 'Meme Chaos V1',
    levelVariants: {
      1: [buildCoreVariant(1)],
      2: [buildCoreVariant(2)],
      3: [buildCoreVariant(3)],
      4: [buildCoreVariant(4)],
      5: [buildCoreVariant(5)],
      6: [buildCoreVariant(6)],
      7: [buildCoreVariant(7)],
      8: createLevelVariants(8, 'memev1', ['1739670312361.gif', '1739670319986.gif', '1739670899878.gif'], 0.92),
      9: createLevelVariants(9, 'memev1', ['1739670919054.gif', '1739671247652.gif', '1739671285896.gif'], 0.9),
      10: createLevelVariants(10, 'memev1', ['1739671341787.gif', '1739671344231.gif', '1739671348043.gif'], 0.9),
      11: createLevelVariants(11, 'memev1', ['1739671350711.gif', '1739671371308.gif', '1739671373241.gif', '1739671610600.gif'], 0.9),
      12: createLevelVariants(12, 'memev1', ['1739671703129.gif', '1739671705849.gif', '1739671709369.gif', '1739671715969.gif', '1739671731015.gif'], 0.92),
    },
  },
  'meme-chaos-v2': {
    id: 'meme-chaos-v2',
    label: 'Meme Chaos V2',
    levelVariants: {
      1: [buildCoreVariant(1)],
      2: [buildCoreVariant(2)],
      3: [buildCoreVariant(3)],
      4: [buildCoreVariant(4)],
      5: [buildCoreVariant(5)],
      6: [buildCoreVariant(6)],
      7: [buildCoreVariant(7)],
      8: createLevelVariants(8, 'memev2', ['1739671815360.gif', '1739671817512.gif', '1739671819525.gif'], 0.9),
      9: createLevelVariants(9, 'memev2', ['1739671823829.gif', '1739671825958.gif', '1739671830748.gif'], 0.88),
      10: createLevelVariants(10, 'memev2', ['1739671832950.gif', '1739671835978.gif', '1739671838068.gif'], 0.9),
      11: createLevelVariants(11, 'memev2', ['1739671857910.gif', '1739671859879.gif', '1739671862820.gif', '1739671869364.gif'], 0.9),
      12: createLevelVariants(12, 'memev2', ['1739671955436.gif', '1739671959677.gif', '1739671979458.gif', '1739672034253.gif', '1739672048542.gif'], 0.92),
    },
  },
  'legend-chaos-v1': {
    id: 'legend-chaos-v1',
    label: 'Legend Chaos',
    levelVariants: {
      1: [buildCoreVariant(1)],
      2: [buildCoreVariant(2)],
      3: [buildCoreVariant(3)],
      4: [buildCoreVariant(4)],
      5: [buildCoreVariant(5)],
      6: [buildCoreVariant(6)],
      7: [buildCoreVariant(7)],
      8: createLevelVariants(8, 'legendv1', ['2450911499.gif', '2458292771.gif', '2458292775.gif'], 0.9),
      9: createLevelVariants(9, 'legendv1', ['2458292776.gif', '2458292778.gif', '2458578611.gif'], 0.88),
      10: createLevelVariants(10, 'legendv1', ['2458382041.gif', '2458469307.gif', '2458926263.gif'], 0.88),
      11: createLevelVariants(11, 'legendv1', ['2458292772.gif', '2458292773.gif', '2458292774.gif', '2458926261.gif'], 0.92),
      12: createLevelVariants(12, 'legendv1', ['1739672152665.gif', '1739672155555.gif', '1739672172157.gif', '1739672182403.gif', '1739672191917.gif'], 0.94),
    },
  },
};

export const CAT_ART_PACK_OPTIONS = Object.values(CAT_ART_PACKS).map((pack) => ({
  id: pack.id,
  label: pack.label,
})) as Array<{ id: CatArtPackId; label: string }>;

const attachPilotAnimation = (
  packId: CatArtPackId,
  level: number,
  variantId: string,
  config: Required<Pick<CatVariantConfig, 'spritesheetKey' | 'spritesheetFile' | 'animationKey' | 'frameConfig'>> & {
    displayRadiusOverride?: number;
    physicsRadiusOverride?: number;
  },
) => {
  const target = CAT_ART_PACKS[packId].levelVariants[level]?.find((variant) => variant.id === variantId);
  if (!target) return;
  target.spritesheetKey = config.spritesheetKey;
  target.spritesheetFile = config.spritesheetFile;
  target.animationKey = config.animationKey;
  target.displayRadiusOverride = config.displayRadiusOverride;
  target.physicsRadiusOverride = config.physicsRadiusOverride;
  target.frameConfig = config.frameConfig;
};

attachPilotAnimation('meme-chaos-v1', 10, 'cat-l10-memev1-1', {
  spritesheetKey: 'cat-sheet-l10-pilot',
  spritesheetFile: 'sheets/cat-l10-anim-strip.png',
  animationKey: 'cat-anim-l10-pilot',
  displayRadiusOverride: 62,
  physicsRadiusOverride: 62,
  frameConfig: {
    frameWidth: 150,
    frameHeight: 150,
    startFrame: 0,
    endFrame: 14,
    frameRate: 12,
    repeat: -1,
  },
});

attachPilotAnimation('meme-chaos-v1', 11, 'cat-l11-memev1-1', {
  spritesheetKey: 'cat-sheet-l11-pilot',
  spritesheetFile: 'sheets/cat-l11-anim-strip.png',
  animationKey: 'cat-anim-l11-pilot',
  displayRadiusOverride: 62,
  physicsRadiusOverride: 62,
  frameConfig: {
    frameWidth: 112,
    frameHeight: 112,
    startFrame: 0,
    endFrame: 9,
    frameRate: 20,
    repeat: -1,
  },
});

attachPilotAnimation('meme-chaos-v1', 12, 'cat-l12-memev1-1', {
  spritesheetKey: 'cat-sheet-l12-pilot',
  spritesheetFile: 'sheets/cat-l12-anim-strip.png',
  animationKey: 'cat-anim-l12-pilot',
  displayRadiusOverride: 62,
  physicsRadiusOverride: 62,
  frameConfig: {
    frameWidth: 150,
    frameHeight: 135,
    startFrame: 0,
    endFrame: 5,
    frameRate: 10,
    repeat: -1,
  },
});

export function getCatArtPack(packId: CatArtPackId = DEFAULT_CAT_ART_PACK): CatArtPackConfig {
  return CAT_ART_PACKS[packId];
}

export function getVariantsForLevel(level: number, packId: CatArtPackId = DEFAULT_CAT_ART_PACK): CatVariantConfig[] {
  return getCatArtPack(packId).levelVariants[level] ?? [];
}

export function getVariantById(variantId: string, packId: CatArtPackId = DEFAULT_CAT_ART_PACK): CatVariantConfig | null {
  const pack = getCatArtPack(packId);
  for (const variants of Object.values(pack.levelVariants)) {
    const found = variants.find((variant) => variant.id === variantId);
    if (found) return found;
  }
  return null;
}

export function getDefaultVariantForLevel(level: number, packId: CatArtPackId = DEFAULT_CAT_ART_PACK): CatVariantConfig {
  const element = ZJU_ELEMENTS[level - 1];
  const fallback = getVariantsForLevel(level, packId)[0];
  const found = element ? getVariantById(element.defaultVariantId, packId) : null;
  return found ?? fallback;
}

function resolveFeelPreset(explicit?: FeelPresetName): FeelPresetName {
  if (explicit) return explicit;

  const fromUrl = new URLSearchParams(window.location.search).get('feel');
  if (fromUrl === 'bouncy' || fromUrl === 'balanced' || fromUrl === 'heavy') {
    return fromUrl;
  }

  return 'balanced';
}

export function createGameConfig(
  parent: HTMLDivElement,
  options?: { feel?: FeelPresetName },
): Phaser.Types.Core.GameConfig {
  const feelName = resolveFeelPreset(options?.feel);
  const feel = FEEL_PRESETS[feelName];

  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#08111f',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'matter',
      matter: {
        gravity: {
          x: 0,
          y: feel.gravityY,
        },
        debug: false,
      },
    },
    scene: [MainScene],
    callbacks: {
      postBoot: (game) => {
        game.registry.set('matterFeelName', feelName);
        game.registry.set('matterFeel', feel);
      },
    },
  };
}
