import { Controller, Post, Body, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NicknameDto } from './dto/nickname.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nickname')
  async nickname(@Body() nicknameDto: NicknameDto) {
    const { nickname } = nicknameDto;

    // JWT 토큰 생성
    const { accessToken } = await this.authService.nickname(nickname);

    return {
      message: '토큰 발급 완료',
      accessToken, // 여기서 토큰을 클라이언트로 보냅니다.
    };
  }
}
