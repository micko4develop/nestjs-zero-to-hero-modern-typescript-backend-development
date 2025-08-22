import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // "Authorization: Bearer <AT>"
      secretOrKey: config.get<string>('JWT_AT_SECRET') || 'at_secret_dev',
      ignoreExpiration: false,
    });
  }

  // payload = { sub, username, iat, exp }
  validate(payload: any) {
    // šta god vratiš ovde biće u req.user
    return { sub: payload.sub, username: payload.username };
  }
}
