import { Module } from './framework/decorators.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { GameModule } from './modules/game/game.module.js';

@Module({
  imports: [AuthModule, GameModule],
})
export class AppModule {
  readonly authModule: AuthModule;
  readonly gameModule: GameModule;

  constructor() {
    this.authModule = new AuthModule();
    this.gameModule = new GameModule();
  }

  get modules() {
    return {
      auth: this.authModule,
      game: this.gameModule,
    };
  }
}
