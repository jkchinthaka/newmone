export type FgBrokerSession = {
  tenantId: string;
  userId: string;
  accessTokenFingerprint: string;
  sessionCookieName: string; // fg_sessionid
  sessionCookieValue: string;
  csrfCookieName: string; // csrftoken
  csrfCookieValue: string;
  csrfToken: string; // from Django session JSON
  expiresAtMs: number;
  createdAtMs: number;
  refreshedAtMs: number;
};

export type FgSessionActor = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  permissions?: string[];
  [key: string]: unknown;
};

export type FgBootstrapResult = {
  session: {
    sessionCookieName: string;
    sessionCookieValue: string;
    csrfCookieName: string;
    csrfCookieValue: string;
    csrfToken: string;
  };
  actor: FgSessionActor | null;
  authenticated: boolean;
};
