import { authService } from "../auth/auth.service";

export const usersService = {
  listUsers() {
    return authService.getPublicUsers();
  },

  getById(id: string) {
    return authService.getById(id);
  }
};
