import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../users.repository';
import { Request, Response } from 'express';

@Injectable()
export class AtRtGuard implements CanActivate {
  private readonly logger = new Logger(AtRtGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly usersRepo: UsersRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();

    this.logger.debug(
      `Incoming ${req.method} ${req.originalUrl || req.url} | ip=${req.ip}`,
    );

    const at = this.getAccessToken(req);
    this.logger.debug(`Access token present: ${!!at} (${this.mask(at)})`);
    if (!at) throw new UnauthorizedException('Missing access token');

    try {
      // 1) Verify AT
      const p: any = await this.jwt.verifyAsync(at, {
        secret: this.config.get('JWT_AT_SECRET') || 'at_secret_dev',
      });
      this.logger.debug(
        `AT verified → sub=${p.sub}, username=${p.username}, exp=${this.ts(
          p?.exp,
        )}`,
      );

      (req as any).user = { sub: p.sub, username: p.username };
      return true;
    } catch (err: any) {
      const expired = err?.name === 'TokenExpiredError';
      this.logger.warn(
        `AT verification failed: name=${err?.name} msg=${err?.message} expired=${expired}`,
      );

      if (!expired) {
        throw new UnauthorizedException('Invalid access token');
      }

      // 2) Try refresh token
      const rt = this.getRefreshToken(req);
      this.logger.debug(`Refresh token present: ${!!rt} (${this.mask(rt)})`);
      if (!rt) {
        throw new UnauthorizedException('Access expired, no refresh token');
      }

      let payload: any;
      try {
        payload = await this.jwt.verifyAsync(rt, {
          secret: this.config.get('JWT_RT_SECRET') || 'rt_secret_dev',
        });
        this.logger.debug(
          `RT verified → sub=${payload.sub}, username=${payload.username}, exp=${this.ts(
            payload?.exp,
          )}`,
        );
      } catch (e: any) {
        this.logger.warn(
          `RT verification failed: name=${e?.name} msg=${e?.message}`,
        );
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 3) Check user & stored RT hash
      const user = await this.usersRepo.findById(payload.sub);
      this.logger.debug(`DB user lookup → ${user ? 'FOUND' : 'NOT FOUND'}`);
      if (!user) throw new UnauthorizedException('User not found');

      const ok = await this.usersRepo.compareRefreshToken(user, rt);
      this.logger.debug(`RT hash match → ${ok}`);
      if (!ok) throw new UnauthorizedException('Refresh token mismatch');

      // 4) Issue new tokens (rotate RT)
      const newPayload = { sub: user.id, username: user.username };

      const newAT = await this.jwt.signAsync(newPayload, {
        secret: this.config.get('JWT_AT_SECRET') || 'at_secret_dev',
        expiresIn: this.config.get('JWT_AT_EXPIRES_IN') || '10m',
      });
      const atDecoded: any = this.jwt.decode(newAT);
      this.logger.debug(
        `Issued new AT (${this.mask(newAT)}) exp=${this.ts(atDecoded?.exp)}`,
      );

      const newRT = await this.jwt.signAsync(newPayload, {
        secret: this.config.get('JWT_RT_SECRET') || 'rt_secret_dev',
        expiresIn: this.config.get('JWT_RT_EXPIRES_IN') || '7d',
      });
      const rtDecoded: any = this.jwt.decode(newRT);
      this.logger.debug(
        `Issued new RT (${this.mask(newRT)}) exp=${this.ts(rtDecoded?.exp)}`,
      );

      await this.usersRepo.setRefreshToken(user.id, newRT);
      this.logger.debug(`DB updated: stored new RT hash for user=${user.id}`);

      // 5) Send back (cookie + header)
      res.cookie('rt', newRT, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // set true in production (HTTPS)
        maxAge: 7 * 24 * 3600_000,
      });
      res.setHeader('x-access-token', newAT);
      this.logger.debug('Set-Cookie: rt (httpOnly) and header: x-access-token');

      // 6) Continue request
      (req as any).user = { sub: user.id, username: user.username };
      (req as any).tokensRefreshed = true;
      this.logger.debug('Request allowed after auto-refresh');
      return true;
    }
  }

  // Helpers
  private getAccessToken(req: Request): string | null {
    const h = req.headers['authorization'];
    if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
    return null;
  }

  private getRefreshToken(req: Request): string | null {
    if ((req as any).signedCookies?.rt) return (req as any).signedCookies.rt;
    if ((req as any).cookies?.rt) return (req as any).cookies.rt;
    const hdr = req.headers['x-refresh-token'];
    return typeof hdr === 'string' ? hdr : null;
  }

  private mask(token?: string | null): string {
    if (!token) return 'null';
    if (token.length <= 12) return '***';
    return `${token.slice(0, 6)}...${token.slice(-6)}`;
  }

  private ts(exp?: number): string {
    return typeof exp === 'number' ? new Date(exp * 1000).toISOString() : 'n/a';
  }
}
