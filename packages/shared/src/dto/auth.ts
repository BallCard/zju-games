export interface AuthUserDto {
  id: string;
  anonymousUid: string;
  nickname: string;
  avatarFrame: string;
  signature: string;
  school: string;
  department: string | null;
  grade: string | null;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}

export interface AnonymousLoginRequestDto {
  deviceFingerprint: string;
}

export interface AnonymousLoginResponseDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface RefreshTokenResponseDto {
  tokens: AuthTokensDto;
}
