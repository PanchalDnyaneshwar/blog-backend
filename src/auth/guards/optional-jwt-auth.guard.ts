import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Make authentication optional - don't throw error if no token
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Try to authenticate, but allow access even if authentication fails
    return super.canActivate(context) as Observable<boolean>;
  }

  handleRequest(err: any, user: any, info: any) {
    // Return user if authenticated, or undefined if not (don't throw error)
    // This allows the endpoint to work with or without authentication
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}

