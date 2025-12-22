import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers['x-internal-token'];

    const expected = this.config.get<string>('INTERNAL_TOKEN');

    if (!expected) {
      // 내부 토큰 미설정이면 개발 편의상 통과 (원하면 막아도 됨)
      return true;
    }

    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }

    return true;
  }
}
