// matching-token.service.ts
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export interface MatchTokenPayload {
  userIds: string[];
  roomId: string;
  expiresIn: string;
  maxPlayers?: number;
  mode?: 'NORMAL' | 'BOSS';
}

@Injectable()
export class MatchingTokenService {
  // 운영에서는 반드시 ENV로 빼기
  private readonly secret: jwt.Secret =
    process.env.MATCH_TOKEN_SECRET || 'match-token-secret';

  issueToken(
    payload: MatchTokenPayload,
    expiresIn: jwt.SignOptions['expiresIn'] = '30s',
  ): string {
    return jwt.sign(payload, this.secret, {
      expiresIn,
    });
  }

  /**
   * 매칭 토큰 검증
   * - 서명 검증
   * - 만료 시간(exp) 검증
   */
  verifyToken(token: string): MatchTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;

      if (!decoded.userIds || !decoded.roomId) {
        throw new Error('INVALID_MATCH_TOKEN_PAYLOAD');
      }

      return {
        userIds: decoded.userIds,
        roomId: decoded.roomId,
        expiresIn: decoded.expiresIn,
        maxPlayers: decoded.maxPlayers,
        mode: decoded.mode,
      };
    } catch (err) {
      throw new Error('INVALID_OR_EXPIRED_MATCH_TOKEN');
    }
  }
}
