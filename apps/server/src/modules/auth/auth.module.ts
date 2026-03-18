import { Module } from '../../framework/decorators.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {
  readonly authService: AuthService;
  readonly authController: AuthController;

  constructor() {
    this.authService = new AuthService();
    this.authController = new AuthController(this.authService);
  }
}
