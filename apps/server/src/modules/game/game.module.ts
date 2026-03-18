import { Module } from '../../framework/decorators.js';
import { GameController } from './game.controller.js';
import { GameService } from './game.service.js';

@Module({
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {
  readonly gameService: GameService;
  readonly gameController: GameController;

  constructor() {
    this.gameService = new GameService();
    this.gameController = new GameController(this.gameService);
  }
}
