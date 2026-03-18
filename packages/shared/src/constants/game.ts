export const GAME_RESULT_VALUES = ['win', 'lose'] as const;

export const DEFAULT_GAME_MODE = 'classic' as const;

export const DEFAULT_BOARD_SIZE = 4 as const;

export const DEFAULT_BOARD_SEED_LENGTH = 64 as const;

export const GAME_DEFAULTS = {
  mode: DEFAULT_GAME_MODE,
  boardSize: DEFAULT_BOARD_SIZE,
  boardSeedLength: DEFAULT_BOARD_SEED_LENGTH,
} as const;

export type GameResultValue = (typeof GAME_RESULT_VALUES)[number];
