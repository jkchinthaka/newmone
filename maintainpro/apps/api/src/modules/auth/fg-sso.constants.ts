/** FG SSO permission catalogue — MaintainPro is the authority. */
export const FG_PERMISSION_KEYS = [
  "fg.access",
  "fg.recording.view",
  "fg.recording.create",
  "fg.recording.edit",
  "fg.recording.submit",
  "fg.review.view",
  "fg.review.perform",
  "fg.qa.view",
  "fg.qa.disposition",
  "fg.nonconformance.view",
  "fg.nonconformance.manage",
  "fg.capa.view",
  "fg.capa.manage",
  "fg.laboratory.view",
  "fg.laboratory.manage",
  "fg.haccp.view",
  "fg.haccp.manage",
  "fg.dispatch.view",
  "fg.dispatch.manage",
  "fg.complaints.view",
  "fg.complaints.manage",
  "fg.reports.view",
  "fg.reports.export",
  "fg.admin"
] as const;

export type FgPermissionKey = (typeof FG_PERMISSION_KEYS)[number];

export const FG_SSO_ISSUER_DEFAULT = "maintainpro";
export const FG_SSO_AUDIENCE_DEFAULT = "fg-digital-recording";
export const FG_SSO_TTL_SECONDS_DEFAULT = 60;
export const FG_SSO_ASSERTION_COOKIE = "fg_sso_assertion";
export const FG_SESSION_COOKIE = "fg_sessionid";
