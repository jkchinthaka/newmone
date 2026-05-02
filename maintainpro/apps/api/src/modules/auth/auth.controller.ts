import { BadRequestException, Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";

import { Public } from "../../common/decorators/public.decorator";
import { SkipTenantContext } from "../../common/decorators/skip-tenant-context.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.data);
    return result;
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.data);
    return result;
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = dto.refreshToken ?? this.getCookie(req, "maintainpro_refresh");
    if (!refreshToken) {
      throw new BadRequestException("Refresh token is required");
    }

    const result = await this.authService.refresh({ refreshToken });
    this.setAuthCookies(res, result.data);
    return result;
  }

  @Public()
  @Post("logout")
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = dto.refreshToken ?? this.getCookie(req, "maintainpro_refresh");
    const result = await this.authService.logout({ refreshToken: refreshToken ?? "" });
    this.clearAuthCookies(res);
    return result;
  }

  @Public()
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @SkipTenantContext()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: { user: { sub: string; tenantId?: string | null } }) {
    return this.authService.me(req.user.sub, req.user.tenantId ?? null);
  }

  @Public()
  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth() {
    return { data: { initiated: true }, message: "Redirecting to Google OAuth" };
  }

  @Public()
  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  googleAuthCallback(@Req() req: { user: unknown }) {
    return {
      data: req.user,
      message: "Google OAuth callback successful"
    };
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken?: string; refreshToken?: string }
  ): void {
    const secure = process.env.NODE_ENV === "production";
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const baseOptions = {
      httpOnly: true,
      sameSite,
      secure,
      path: "/"
    };

    if (tokens.accessToken) {
      res.cookie("maintainpro_access", tokens.accessToken, {
        ...baseOptions,
        maxAge: 15 * 60 * 1000
      });
    }

    if (tokens.refreshToken) {
      res.cookie("maintainpro_refresh", tokens.refreshToken, {
        ...baseOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
  }

  private clearAuthCookies(res: Response): void {
    const secure = process.env.NODE_ENV === "production";
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const options = { httpOnly: true, sameSite, secure, path: "/" };
    res.clearCookie("maintainpro_access", options);
    res.clearCookie("maintainpro_refresh", options);
  }

  private getCookie(req: Request, name: string): string | null {
    const header = req.headers.cookie;
    if (!header) return null;

    const match = header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));

    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  }
}
