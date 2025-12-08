import { Controller, Post, Body, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NicknameDto } from './dto/nickname.dto';
import type { Response } from 'express';




@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nickname')
  async nickname(
		@Body() nicknameDto: NicknameDto, 
	  @Res({ passthrough: true }) res: Response,) {

		const { nickname } = nicknameDto;

			// 1. JWT 토큰 생성
    const { accessToken } = await this.authService.nickname(nickname);

			// 2. 토큰을 쿠키에 저장
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false,
			//secure: process.env.NODE_ENV === 'production', // 필수: HTTPS 환경에서만 전송 (로컬에서는 false)
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1시간
    });

			// 3. 성공 응답
    return {
      message: '세션 생성 완료. 토큰이 쿠키에 저장되었습니다.',
    };
  }
}
