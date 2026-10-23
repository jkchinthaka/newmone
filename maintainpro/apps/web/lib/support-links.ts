/** Nelna IT Help Desk. Override with NEXT_PUBLIC_IT_HELP_DESK_URL at build time if it moves. */
export const IT_HELP_DESK_URL =
  process.env.NEXT_PUBLIC_IT_HELP_DESK_URL?.trim() || "https://nelna-helpdesk.southeastasia.cloudapp.azure.com/submit";

/** Account lock after this many wrong passwords. Mirrors MAX_FAILED_LOGIN_ATTEMPTS in the API. */
export const LOGIN_ATTEMPTS_BEFORE_LOCK = 5;

/** Lock length per round: 1st, 2nd, 3rd and later. Mirrors LOCKOUT_MINUTES in the API. */
export const LOGIN_LOCKOUT_MINUTES = [5, 10, 30] as const;
