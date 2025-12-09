import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from './jwt/jwt-payload.interface';
import { JwtTokenService } from './jwt/jwt.service';

@Injectable()
export class AuthService {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  async nickname(nickname: string) {
    const payload: JwtPayload = {
      uuid: uuidv4(),
      nickname,
    };
    console.log('Payload:', payload);

    return {
      accessToken: this.jwtTokenService.sign(payload),
    };
  }
}
