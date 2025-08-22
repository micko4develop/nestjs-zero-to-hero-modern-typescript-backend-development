import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// Izvlačimo RT iz signed cookie, običnog cookie-a ili headera x-refresh-token
function refreshExtractor(req: Request): string | null {
  if (req?.signedCookies?.rt) return req.signedCookies.rt;
  if (req?.cookies?.rt) return req.cookies.rt;
  const hdr = req?.headers['x-refresh-token'];
  return typeof hdr === 'string' ? hdr : null;
}

@Injectable()
export class JwtRtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: refreshExtractor,
      secretOrKey: config.get<string>('JWT_RT_SECRET') || 'rt_secret_dev',
      ignoreExpiration: false,
      passReqToCallback: true, // da u validate imamo pristup raw tokenu
    });
  }

  validate(req: Request, payload: any) {
    const refreshToken = refreshExtractor(req);
    // Ovo će biti dostupno kao req.user u kontroleru za /refresh
    return { sub: payload.sub, username: payload.username, refreshToken };
  }
}
