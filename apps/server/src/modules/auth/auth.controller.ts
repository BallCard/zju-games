import { Controller } from '../../framework/decorators.js';
import { AuthService, type LoginInput } from './auth.service.js';
import type { AnonymousLoginRequestDto } from '@zju/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login(input: LoginInput) {
    return this.authService.login(input);
  }

  anonymousLogin(input: AnonymousLoginRequestDto) {
    return this.authService.anonymousLogin(input);
  }

  profile(userId: string) {
    return this.authService.getProfile(userId);
  }
}
