import { Injectable } from '../../framework/decorators.js';
import { GAME_DEFAULTS } from '@zju/shared';
import type {
  GameConfigDto,
  GameSessionFinishRequestDto,
  GameSessionFinishResponseDto,
  GameSessionStartRequestDto,
  GameSessionStartResponseDto,
} from '@zju/shared';

export interface GameSummary {
  readonly id: string;
  readonly title: string;
  readonly status: 'draft' | 'active' | 'finished';
}

export interface SubmitMoveInput {
  readonly gameId: string;
  readonly playerId: string;
  readonly move: string;
}

function randomSeed(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

@Injectable()
export class GameService {
  listGames(): GameSummary[] {
    return [
      {
        id: 'demo-game',
        title: 'Demo Game',
        status: 'active',
      },
    ];
  }

  getGame(gameId: string): GameSummary {
    return {
      id: gameId,
      title: 'Demo Game',
      status: 'active',
    };
  }

  submitMove(input: SubmitMoveInput) {
    return {
      accepted: true,
      gameId: input.gameId,
      playerId: input.playerId,
      move: input.move,
    };
  }

  startSession(input: GameSessionStartRequestDto): GameSessionStartResponseDto {
    const mode = input.mode || GAME_DEFAULTS.mode;
    const boardSeed = input.boardSeed || randomSeed(GAME_DEFAULTS.boardSeedLength);
    return {
      sessionId: randomSeed(24),
      mode,
      boardSeed,
      startedAt: new Date().toISOString(),
    };
  }

  finishSession(input: GameSessionFinishRequestDto): GameSessionFinishResponseDto {
    return {
      sessionId: input.sessionId,
      saved: true,
      bestScore: input.score,
    };
  }

  getConfig(): GameConfigDto {
    return {
      defaultMode: GAME_DEFAULTS.mode,
      availableModes: [GAME_DEFAULTS.mode],
      defaultBoardSize: GAME_DEFAULTS.boardSize,
      defaultBoardSeedLength: GAME_DEFAULTS.boardSeedLength,
    };
  }
}
