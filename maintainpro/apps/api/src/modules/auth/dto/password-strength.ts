/** Single password strength rule for reset, invite and self-service change. */
export const PASSWORD_STRENGTH_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
export const PASSWORD_STRENGTH_MESSAGE =
  "Password must contain at least 8 characters, one uppercase letter, one number, and one special character";
