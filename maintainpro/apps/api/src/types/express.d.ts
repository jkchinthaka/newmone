declare namespace Express {
  interface AuthUser {
    sub: string;
    email: string;
    role: string;
  }

  interface Request {
    user?: AuthUser;
  }
}
