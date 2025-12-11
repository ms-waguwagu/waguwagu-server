import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtTokenModule } from './jwt/jwt.module';

import { JwtStrategy } from './jwt/jwt.strategy';

@Module({
  imports: [JwtTokenModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtTokenModule],
})
export class AuthModule {}
