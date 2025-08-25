import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from './user.entity';

export interface UserPayload {
  sub: string;
  username: string;
}

/**
 * Custom parameter decorator to extract user data from the request.
 * 
 * Usage examples:
 * 
 * 1. Get full user payload:
 *    @GetUser() user: UserPayload
 * 
 * 2. Get specific user property:
 *    @GetUser('sub') userId: string
 *    @GetUser('username') username: string
 * 
 * Note: This decorator expects the user data to be attached to req.user 
 * by authentication guards (like AtRtGuard).
 */
export const GetUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext): UserPayload | string => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserPayload = request.user;

    if (!user) {
      throw new Error('User not found in request. Ensure authentication guard is applied.');
    }

    // If no specific property is requested, return the entire user object
    if (!data) {
      return user;
    }

    // Return the specific property if requested
    return user[data];
  },
);
 