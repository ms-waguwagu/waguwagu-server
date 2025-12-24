import { Body, Controller, Post, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { NicknameDto } from './dto/nickname.dto';
import { JwtGuard } from './jwt/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 구글 OAuth 로그인
  @Post('google')
  async googleLogin(@Body() body: { idToken: string }) {
    const { idToken } = body;

    return this.authService.googleLogin(idToken);
    // return { accessToken, isNewUser }
  }

  // 로그인 이후 닉네임 설정 (JWT 필수)
  @UseGuards(JwtGuard)
  @Post('nickname')
  async nickname(
    @Req() req,
    @Res() res: Response,
    @Body() nicknameDto: NicknameDto,
  ) {
    const { nickname } = nicknameDto;
    const { googleSub } = req.user;

    const { accessToken } = await this.authService.nickname(
      googleSub,
      nickname,
    );

    // accessToken을 쿠키에 저장
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
    });

    return res.json({
      message: '닉네임 설정 완료',
      accessToken,
    });
  }
}
