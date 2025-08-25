import { Body, Controller, Post, Get, UseGuards, Req, Res, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { AtRtGuard } from './guards/at-rt.guard';

class AuthCredentialsDto {
  username: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/signup')
  async signUp(@Body() dto: AuthCredentialsDto, @Res() res: Response) {
    const tokens = await this.authService.signUp(dto);
    // postavi RT u HTTP-only cookie (preporučeno)
    res.cookie('rt', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,            // u produkciji true (HTTPS)
      maxAge: 7 * 24 * 3600_000 // 7 dana
    });
    return res.status(201).json({ accessToken: tokens.accessToken });
  }

  @Post('/login')
  @HttpCode(200)
  async login(@Body() dto: AuthCredentialsDto, @Res() res: Response) {
    const tokens = await this.authService.login(dto);
    res.cookie('rt', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 3600_000
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
    res.cookie('rt', tokens.refreshToken, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7*24*3600_000 });
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
