import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";

import { Public } from "../../common/decorators/public.decorator";
import { SkipTenantContext } from "../../common/decorators/skip-tenant-context.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  private static readonly ACCESS_COOKIE = "maintainpro_access";
  private static readonly REFRESH_COOKIE = "maintainpro_refresh";
  private static readonly CSRF_COOKIE = "maintainpro_csrf";
  private static readonly CSRF_HEADER = "x-csrf-token";

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.data);
    return result;
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.data);
    return result;
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshTokenFromCookie = this.getCookie(req, AuthController.REFRESH_COOKIE);
    const refreshToken = dto.refreshToken ?? refreshTokenFromCookie;
    if (!refreshToken) {
      throw new BadRequestException("Refresh token is required");
    }
    if (!dto.refreshToken) {
      this.assertCsrfForCookieFlow(req);
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
    const refreshTokenFromCookie = this.getCookie(req, AuthController.REFRESH_COOKIE);
    const refreshToken = dto.refreshToken ?? refreshTokenFromCookie;
    if (!dto.refreshToken && refreshTokenFromCookie) {
      this.assertCsrfForCookieFlow(req);
    }
    const result = await this.authService.logout({ refreshToken: refreshToken ?? "" });
    this.clearAuthCookies(res);
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  async logoutAll(@Req() req: { user: { sub: string } }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logoutAll(req.user.sub);
    this.clearAuthCookies(res);
    return result;
  }

  @Public()
  @Post("forgot-password")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post("reset-password")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get("invite/verify")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyInvite(@Req() req: Request) {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token.trim()) {
      throw new BadRequestException("token is required");
    }
    return this.authService.verifyInvite(token.trim());
  }

  @Public()
  @Post("invite/accept")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
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
      res.cookie(AuthController.ACCESS_COOKIE, tokens.accessToken, {
        ...baseOptions,
        maxAge: 15 * 60 * 1000
      });
    }

    if (tokens.refreshToken) {
      res.cookie(AuthController.REFRESH_COOKIE, tokens.refreshToken, {
        ...baseOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Non-httpOnly token used for double-submit CSRF protection.
      res.cookie(AuthController.CSRF_COOKIE, this.generateCsrfToken(), {
        httpOnly: false,
        sameSite,
        secure,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
  }

  private clearAuthCookies(res: Response): void {
    const secure = process.env.NODE_ENV === "production";
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const options = { httpOnly: true, sameSite, secure, path: "/" };
    res.clearCookie(AuthController.ACCESS_COOKIE, options);
    res.clearCookie(AuthController.REFRESH_COOKIE, options);
    res.clearCookie(AuthController.CSRF_COOKIE, {
      httpOnly: false,
      sameSite,
      secure,
      path: "/"
    });
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

  private getHeader(req: Request, name: string): string | null {
    const header = req.headers[name];
    if (typeof header === "string") {
      return header.trim().length > 0 ? header.trim() : null;
    }
    if (Array.isArray(header) && header.length > 0) {
      const first = header[0]?.trim();
      return first && first.length > 0 ? first : null;
    }
    return null;
  }

  private generateCsrfToken(): string {
    return randomBytes(32).toString("hex");
  }

  private assertCsrfForCookieFlow(req: Request): void {
    const csrfCookie = this.getCookie(req, AuthController.CSRF_COOKIE);
    const csrfHeader = this.getHeader(req, AuthController.CSRF_HEADER);
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException("CSRF validation failed");
    }
  }
}
