import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtTokenService {
  constructor(private readonly jwtService: JwtService) {}

  // 토큰 발급
  sign(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  // 토큰 검증
  verify(token: string) {
    return this.jwtService.verify(token);
  }
}
