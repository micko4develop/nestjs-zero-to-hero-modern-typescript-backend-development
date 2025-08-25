import { Body, Controller, Post, Get, UseGuards, Req, Res, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { AtRtGuard } from './guards/at-rt.guard';
import { ConfigService } from '@nestjs/config';

class AuthCredentialsDto {
  username: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * Converts JWT expiration time format (e.g., '7d', '10m', '1h') to milliseconds
   * @param expirationTime - JWT expiration time string
   * @returns number of milliseconds
   */
  private convertToMilliseconds(expirationTime: string): number {
    const timeValue = parseInt(expirationTime.slice(0, -1));
    const timeUnit = expirationTime.slice(-1);
    
    switch (timeUnit) {
      case 's': return timeValue * 1000;
      case 'm': return timeValue * 60 * 1000;
      case 'h': return timeValue * 60 * 60 * 1000;
      case 'd': return timeValue * 24 * 60 * 60 * 1000;
      case 'w': return timeValue * 7 * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unsupported time unit: ${timeUnit}`);
    }
  }

  /**
   * Gets the refresh token max age from configuration
   */
  private getRefreshTokenMaxAge(): number {
    const rtExpiresIn = this.configService.get<string>('JWT_RT_EXPIRES_IN') || '7d';
    return this.convertToMilliseconds(rtExpiresIn);
  }

  @Post('/signup')
  async signUp(@Body() dto: AuthCredentialsDto, @Res() res: Response) {
    const tokens = await this.authService.signUp(dto);
    const maxAge = this.getRefreshTokenMaxAge();
    
    // postavi RT u HTTP-only cookie (preporučeno)
    res.cookie('rt', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,            // u produkciji true (HTTPS)
      maxAge: maxAge
    });
    return res.status(201).json({ accessToken: tokens.accessToken });
  }

  @Post('/login')
  @HttpCode(200)
  async login(@Body() dto: AuthCredentialsDto, @Res() res: Response) {
    const tokens = await this.authService.login(dto);
    const maxAge = this.getRefreshTokenMaxAge();
    
    res.cookie('rt', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: maxAge
    });
    return res.json({ accessToken: tokens.accessToken });
  }

  // Refresh preko Passport strategije (RT se čita iz cookie-a ili x-refresh-token headera)
  @Post('/refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(200)
  async refresh(@Req() req: any, @Res() res: Response) {
    const { sub: userId, refreshToken } = req.user;
    const tokens = await this.authService.refresh(userId, refreshToken);
    const maxAge = this.getRefreshTokenMaxAge();
    
    res.cookie('rt', tokens.refreshToken, { 
      httpOnly: true, 
      sameSite: 'lax', 
      secure: false, 
      maxAge: maxAge 
    });
    return res.json({ accessToken: tokens.accessToken });
  }

  @Post('/logout')
  @HttpCode(200)
  async logout(@Body() body: { userId: string }, @Res() res: Response) {
    await this.authService.logout(body.userId);
    res.clearCookie('rt');
    return res.json({ success: true });
  }

  @Get('/profile')
  @UseGuards(AtRtGuard)
  async getProfile(@Req() req: any) {
    const userProfile = await this.authService.getUserProfile(req.user.sub);
    return userProfile;
  }
}
