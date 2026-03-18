import type { GameResultValue } from '../constants/game';

export interface GameSessionStartRequestDto {
  mode: string;
  boardSeed?: string;
}

export interface GameSessionStartResponseDto {
  sessionId: string;
  mode: string;
  boardSeed: string;
  startedAt: string;
}

export interface GameSessionFinishRequestDto {
  sessionId: string;
  score: number;
  durationSec: number;
  result: GameResultValue;
  comboMax: number;
  boardSeed: string;
}

export interface GameSessionFinishResponseDto {
  sessionId: string;
  saved: boolean;
  bestScore: number | null;
}

export interface GameConfigDto {
  defaultMode: string;
  availableModes: string[];
  defaultBoardSize: number;
  defaultBoardSeedLength: number;
}
