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

export interface MatterFeelPreset {
  gravityY: number;
  restitution: number;
  friction: number;
  frictionAir: number;
  frictionStatic: number;
  densityScale: number;
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

export interface ZjuElementConfig {
  level: number;
  name: string;
  radius: number;
  score: number;
  textureKey: string;
}

export const ZJU_ELEMENTS: ZjuElementConfig[] = [
  { level: 1, name: '\u62a2\u8bfe\u9a8c\u8bc1\u7801', radius: 14, score: 12, textureKey: 'zju-lv-1' },
  { level: 2, name: '\u9009\u8bfe\u8f6c\u5708\u5708', radius: 17, score: 23, textureKey: 'zju-lv-2' },
  { level: 3, name: '\u65e9\u516b\u95f9\u949f', radius: 21, score: 43, textureKey: 'zju-lv-3' },
  { level: 4, name: '\u9ea6\u9999\u997c', radius: 26, score: 81, textureKey: 'zju-lv-4' },
  { level: 5, name: '\u5927\u4e0d\u5217\u98a0\u571f\u8c46', radius: 32, score: 152, textureKey: 'zju-lv-5' },
  { level: 6, name: '\u5c0f\u767d\u8f66', radius: 40, score: 286, textureKey: 'zju-lv-6' },
  { level: 7, name: '\u7d2b\u91d1\u6e2f\u5927\u767d\u9e45', radius: 50, score: 538, textureKey: 'zju-lv-7' },
  { level: 8, name: '\u542f\u771f\u6e56\u665a\u98ce', radius: 62, score: 1011, textureKey: 'zju-lv-8' },
  { level: 9, name: '\u56fe\u4e66\u9986\u6ee1\u5ea7\u63d0\u793a', radius: 77, score: 1901, textureKey: 'zju-lv-9' },
  { level: 10, name: '\u95e8\u7981\u5012\u8ba1\u65f6', radius: 95, score: 3574, textureKey: 'zju-lv-10' },
  { level: 11, name: '\u6ee1\u7ee9\u4f20\u8bf4\uff084.0/4.8\uff09', radius: 111, score: 6719, textureKey: 'zju-lv-11' },
  { level: 12, name: '\u7afa\u9662\u795e\u4ed9', radius: 129, score: 12631, textureKey: 'zju-lv-12' },
];

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