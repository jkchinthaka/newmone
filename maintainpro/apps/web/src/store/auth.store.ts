import { create } from "zustand";
import { persist } from "zustand/middleware";

import { User } from "@maintainpro/shared-types";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  setSession: (user: User, tokens: AuthTokens) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: (user, tokens) =>
        set({
          user,
          tokens
        }),
      clearSession: () =>
        set({
          user: null,
          tokens: null
        })
    }),
    {
      name: "maintainpro-auth"
    }
  )
);
