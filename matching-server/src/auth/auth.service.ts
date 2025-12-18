import {
	Injectable,
	InternalServerErrorException,
	UnauthorizedException,
  } from '@nestjs/common';
  import { JwtPayload } from './jwt/jwt-payload.interface';
  import { JwtTokenService } from './jwt/jwt.service';
  import { OAuth2Client } from 'google-auth-library';
  
  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  
  @Injectable()
  export class AuthService {
	constructor(private readonly jwtTokenService: JwtTokenService) {}
  
	// 🔥 구글 OAuth 로그인
	async googleLogin(idToken: string) {
	  try {
		const ticket = await googleClient.verifyIdToken({
		  idToken,
		  audience: process.env.GOOGLE_CLIENT_ID,
		});
  
		const payload = ticket.getPayload();
		if (!payload) {
		  throw new UnauthorizedException('Google payload 없음');
		}
  
		const googleSub = payload.sub;
  
		const jwtPayload: JwtPayload = {
		  googleSub,
		  nickname: null, // 최초 로그인 시 없음
		};
  
		const accessToken = this.jwtTokenService.sign(jwtPayload);
  
		return {
		  accessToken,
		  isNewUser: true, // 🔥 지금 구조에선 항상 신규
		};
	  } catch (err) {
		console.error('AuthService.googleLogin Error:', err);
		throw new UnauthorizedException('구글 인증 실패');
	  }
	}
  
	// 🔥 OAuth 이후 닉네임 설정
	async nickname(googleSub: string, nickname: string) {
	  try {
		const payload: JwtPayload = {
		  googleSub,
		  nickname,
		};
  
		console.log('JWT Payload:', payload);
  
		const token = this.jwtTokenService.sign(payload);
  
		return {
		  accessToken: token,
		};
	  } catch (err) {
		console.error('AuthService.nickname Error:', err);
		throw new InternalServerErrorException(
		  '토큰 생성 중 문제가 발생했습니다.',
		);
	  }
	}
  }
  