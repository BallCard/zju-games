import { Controller } from '../../framework/decorators.js';
import { GameService, type SubmitMoveInput } from './game.service.js';
import type { GameSessionFinishRequestDto, GameSessionStartRequestDto } from '@zju/shared';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  listGames() {
    return this.gameService.listGames();
  }

  getGame(gameId: string) {
    return this.gameService.getGame(gameId);
  }

  submitMove(input: SubmitMoveInput) {
    return this.gameService.submitMove(input);
  }

  startSession(input: GameSessionStartRequestDto) {
    return this.gameService.startSession(input);
  }

  finishSession(input: GameSessionFinishRequestDto) {
    return this.gameService.finishSession(input);
  }

  config() {
    return this.gameService.getConfig();
  }
}
