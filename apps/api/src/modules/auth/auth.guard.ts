import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[this.authService.cookieName];

    if ((await this.authService.isSetupComplete()) && this.authService.verifySession(token)) {
      return true;
    }

    throw new UnauthorizedException("Authentification requise.");
  }
}
