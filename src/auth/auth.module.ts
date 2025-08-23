// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';

import { User } from './user.entity';
import { UsersRepository } from './users.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAtStrategy } from './strategies/jwt-at.strategy';
import { JwtRtStrategy } from './strategies/jwt-rt.strategy';
import { AtRtGuard } from './guards/at-rt.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),     // provides JwtService
  ],
  controllers: [AuthController],
  providers: [UsersRepository, AuthService, JwtAtStrategy, JwtRtStrategy, AtRtGuard],
  exports: [
    UsersRepository,
    AtRtGuard,                  // so other modules can @UseGuards(AtRtGuard)
    JwtModule,                  // <-- IMPORTANT: expose JwtService to consumers
  ],
})
export class AuthModule {}
