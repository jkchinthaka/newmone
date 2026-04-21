import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  private static readonly logger = new Logger(GoogleStrategy.name);

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const clientID = configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = configService.get<string>("GOOGLE_CLIENT_SECRET");
    const oauthEnabled = Boolean(clientID && clientSecret);

    super({
      clientID: clientID || "disabled-google-client-id",
      clientSecret: clientSecret || "disabled-google-client-secret",
      callbackURL: configService.get<string>("GOOGLE_CALLBACK_URL", "http://localhost:3000/api/auth/google/callback"),
      scope: ["email", "profile"]
    });

    if (!oauthEnabled) {
      GoogleStrategy.logger.warn("Google OAuth credentials are not configured. OAuth endpoints remain disabled for practical use.");
    }
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    return {
      email: profile.emails?.[0]?.value,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      oauthProvider: "google"
    };
  }
}
