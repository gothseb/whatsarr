import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { PasswordDto } from "./auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("status")
  async getStatus(@Req() request: Request) {
    const isSetupComplete = await this.authService.isSetupComplete();
    const isAuthenticated =
      isSetupComplete &&
      this.authService.verifySession(request.cookies?.[this.authService.cookieName]);

    return { isSetupComplete, isAuthenticated };
  }

  @Post("setup")
  async setup(@Body() body: PasswordDto, @Res({ passthrough: true }) res: Response) {
    const token = await this.authService.setup(body.password);
    res.cookie(this.authService.cookieName, token, this.authService.getCookieOptions());
    return { ok: true };
  }

  @Post("login")
  async login(@Body() body: PasswordDto, @Res({ passthrough: true }) res: Response) {
    const token = await this.authService.login(body.password);
    res.cookie(this.authService.cookieName, token, this.authService.getCookieOptions());
    return { ok: true };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.authService.cookieName, { path: "/" });
    return { ok: true };
  }
}
