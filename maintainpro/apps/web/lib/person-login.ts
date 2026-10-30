import { passwordStrengthError } from "@/lib/password-change-required";

/** How a new login gets its first password. SET_PASSWORD = the admin types it now. */
export type PersonInviteMethod = "SET_PASSWORD" | "INVITE_EMAIL" | "TEMP_PASSWORD" | "COPY_LINK";

export const PERSON_INVITE_METHOD_LABELS: Record<PersonInviteMethod, string> = {
  SET_PASSWORD: "Set a password now",
  INVITE_EMAIL: "Send invite email",
  TEMP_PASSWORD: "Generate a temporary password",
  COPY_LINK: "Copy an invite link"
};

export type PersonLoginForm = {
  canLogin: boolean;
  active: boolean;
  email: string;
  roleId: string;
  branchName: string;
  inviteMethod: PersonInviteMethod;
  initialPassword: string;
  confirmPassword: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login fields are only required when "Can log in" is ticked: then email and role are required,
 * and "Set a password now" also needs a strong password typed twice.
 */
export function personLoginIssues(form: PersonLoginForm): string[] {
  if (!form.canLogin) return [];
  const issues: string[] = [];
  if (!form.active) issues.push("An inactive person cannot log in.");
  if (!form.email.trim()) issues.push("Enter a login email.");
  else if (!EMAIL_PATTERN.test(form.email.trim())) issues.push("Enter a valid login email.");
  if (!form.roleId) issues.push("Choose a role.");
  if (!form.branchName.trim()) issues.push("Enter the branch.");
  if (form.inviteMethod === "SET_PASSWORD") {
    if (!form.initialPassword) issues.push("Enter a password.");
    else {
      const weak = passwordStrengthError(form.initialPassword);
      if (weak) issues.push(weak);
      if (form.initialPassword !== form.confirmPassword) issues.push("The two passwords do not match.");
    }
  }
  return issues;
}
