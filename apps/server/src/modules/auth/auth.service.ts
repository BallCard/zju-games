import { Injectable } from '../../framework/decorators.js';
import type { AnonymousLoginRequestDto, AnonymousLoginResponseDto, AuthUserDto } from '@zju/shared';

export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly userId: string;
}

@Injectable()
export class AuthService {
  validateCredentials(input: LoginInput): boolean {
    return input.username.trim().length > 0 && input.password.trim().length > 0;
  }

  login(input: LoginInput): AuthSession {
    if (!this.validateCredentials(input)) {
      throw new Error('Invalid credentials.');
    }

    return {
      accessToken: `dev-token-for-${input.username}`,
      userId: input.username,
    };
  }

  getProfile(userId: string): AuthUserDto {
    return {
      id: userId,
      anonymousUid: `anon_${userId}`,
      nickname: userId,
      avatarFrame: 'default',
      signature: 'Keep merging.',
      school: 'ZJU',
      department: null,
      grade: null,
    };
  }

  anonymousLogin(input: AnonymousLoginRequestDto): AnonymousLoginResponseDto {
    const normalized = input.deviceFingerprint.trim().slice(0, 12) || 'guest';
    const userId = `u_${normalized}`;
    return {
      user: this.getProfile(userId),
      tokens: {
        accessToken: `access-${normalized}`,
        refreshToken: `refresh-${normalized}`,
        expiresInSec: 900,
      },
    };
  }
}
