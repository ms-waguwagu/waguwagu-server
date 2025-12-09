import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from './jwt/jwt-payload.interface';
import { JwtTokenService } from './jwt/jwt.service';

@Injectable()
export class AuthService {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  async nickname(nickname: string) {
    try{
			const payload: JwtPayload = {
      	uuid: uuidv4(),
      	nickname,
    	};
			console.log('Payload:', payload);

			const token = this.jwtTokenService.sign(payload);

			return {
				accessToken: token,
			};
		} catch (err) {
      console.error('AuthService.nickname Error:', err);
      throw new InternalServerErrorException('토큰 생성 중 문제가 발생했습니다.');
    }
  }
}
