import { Controller, Post, Body, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NicknameDto } from './dto/nickname.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nickname')
  async nickname(@Body() nicknameDto: NicknameDto) {
    try{	
			const { nickname } = nicknameDto;

    	// JWT 토큰 생성
    	const { accessToken } = await this.authService.nickname(nickname);

    	return {
      	message: '토큰 발급 완료',
      	accessToken,
    	};
			} catch (err) {
      	return {
        	message: err.message,
      	};
    }
  }
}
