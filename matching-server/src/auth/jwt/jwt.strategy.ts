import { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 쿠키에서 토큰을 추출하는 헬퍼 함수
const extractJwtFromCookie = (req: Request) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      // 1. 쿠키에서 토큰을 추출
      jwtFromRequest: extractJwtFromCookie,
      ignoreExpiration: false, // 만료 시간을 엄격히 검사
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  // 2. 토큰이 유효할 경우 호출됨
  async validate(payload: any) {
    // 검증 후 Request 객체에 담아줄 정보를 반환
    return { userId: payload.uuid, nickname: payload.nickname };
  }
}
