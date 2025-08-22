import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // ako koristiš env
import { UsersRepository } from './users.repository';
import * as bcrypt from 'bcrypt';

export type JwtTokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService, 
  ) {}

  async signUp(dto: { username: string; password: string }): Promise<JwtTokens> {
    const exists = await this.usersRepo.findByUsername(dto.username);
    if (exists) throw new BadRequestException('Username already taken');

    const user = await this.usersRepo.createUser(dto.username, dto.password);
    const tokens = await this.getTokens(user.id, user.username);
    await this.usersRepo.setRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async login(dto: { username: string; password: string }): Promise<JwtTokens> {
    const user = await this.usersRepo.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.getTokens(user.id, user.username);
    await this.usersRepo.setRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async refresh(userId: string, refreshToken: string): Promise<JwtTokens> {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new UnauthorizedException();

    try {
      await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_RT_SECRET') || 'rt_secret_dev',
      });
    } catch {
      throw new UnauthorizedException();
    }

    const matches = await this.usersRepo.compareRefreshToken(user, refreshToken);
    if (!matches) throw new UnauthorizedException();

    const tokens = await this.getTokens(user.id, user.username);
    await this.usersRepo.setRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepo.setRefreshToken(userId, null);
    throw new HttpException(
        {
            statusCode: HttpStatus.OK,
            success: true,
        },
        HttpStatus.OK,
    );  
  }

  private async getTokens(userId: string, username: string): Promise<JwtTokens> {
    const payload = { sub: userId, username };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_AT_SECRET') || 'at_secret_dev',
      expiresIn: this.config.get<string>('JWT_AT_EXPIRES_IN') || '10m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_RT_SECRET') || 'rt_secret_dev',
      expiresIn: this.config.get<string>('JWT_RT_EXPIRES_IN') || '7d',
    });

    return { accessToken, refreshToken };
  }
}
