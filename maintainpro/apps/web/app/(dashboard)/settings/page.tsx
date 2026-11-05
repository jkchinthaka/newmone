"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronRight, Settings2, ShieldCheck, Users, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { apiClient } from "@/lib/api-client";
import { USER_KEY } from "@/lib/auth-storage";
import { passwordStrengthError, userMustChangePassword } from "@/lib/password-change-required";
import {
  MUTED_NOTIFICATION_TYPES,
  passwordChangeError,
  settingsAdminShortcuts,
  visibleNotificationChannels
} from "@/lib/notification-inbox";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
};

type Preferences = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
};

type Rules = {
  mutedTypes: string[];
  onlyCritical: boolean;
  emailOnlyOverdue: boolean;
};

type Envelope<T> = { data: T };

const TABS = ["profile", "notifications", "security"] as const;
type SettingsTab = (typeof TABS)[number];

const CHANNEL_LABELS: Record<keyof Preferences, string> = {
  inApp: "In-app",
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push"
};

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (char) => char.toUpperCase());
}

/** The login payload cached mustChangePassword: true; drop it once the password is changed. */
function clearStoredPasswordPending() {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify({ ...JSON.parse(raw), mustChangePassword: false }));
  } catch {
    // Storage unavailable: nothing cached to correct.
  }
}

const FIELD = "mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm";
const PRIMARY_BTN = "min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

const CHANNEL_HINTS: Record<keyof Preferences, string> = {
  inApp: "Bell icon inside Nelna Care",
  email: "Sent to your email address",
  sms: "Text message to your phone",
  whatsapp: "WhatsApp message to your phone",
  push: "Alerts on this device"
};

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative mt-1 block">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full rounded-lg border border-slate-300 px-3 pr-14 text-sm"
      />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs font-medium text-slate-500 hover:text-slate-800">
        {show ? "Hide" : "Show"}
      </button>
    </span>
  );
}

function StrengthHint({ value }: { value: string }) {
  const checks = [
    { ok: value.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(value), label: "a capital letter" },
    { ok: /\d/.test(value), label: "a number" },
    { ok: /[^A-Za-z\d]/.test(value), label: "a symbol" }
  ];
  const score = checks.filter((c) => c.ok).length;
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {checks.map((_, i) => (
          <i key={i} className={`h-1 flex-1 rounded ${i < score ? (score === 4 ? "bg-emerald-500" : "bg-amber-400") : "bg-slate-200"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {checks.map((c, i) => (
          <span key={c.label} className={c.ok ? "text-emerald-600" : ""}>
            {c.ok ? "✓" : "○"} {c.label}
            {i < checks.length - 1 ? "  " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}

function ShortcutIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  const Icon: LucideIcon = l.includes("user") ? Users : l.includes("role") ? ShieldCheck : l.includes("organi") ? Building2 : l.includes("technical") ? Wrench : Settings2;
  return <Icon size={16} />;
}

function SettingsWorkspace() {
  const user = useCurrentUser();
  const role = extractRoleName(user);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const requested = params.get("tab");
  // Server truth (auth/me stays reachable while a temporary password is pending).
  const meQuery = useQuery({
    queryKey: ["auth", "me", "password-pending"],
    queryFn: async () => (await apiClient.get<Envelope<unknown>>("/auth/me")).data.data
  });
  const passwordPending = userMustChangePassword(meQuery.data);
  // A pending temporary password locks everything except the password form.
  const tab: SettingsTab = passwordPending
    ? "security"
    : TABS.includes(requested as SettingsTab)
      ? (requested as SettingsTab)
      : "profile";

  const profileQuery = useQuery({
    queryKey: ["settings", "profile"],
    enabled: !passwordPending,
    queryFn: async () => (await apiClient.get<Envelope<Profile>>("/settings/profile")).data.data
  });

  const [profile, setProfile] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [emailPassword, setEmailPassword] = useState("");
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Preferences | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [muteOpen, setMuteOpen] = useState(false);
  const [muteQuery, setMuteQuery] = useState("");

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfile({
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      email: profileQuery.data.email,
      phone: profileQuery.data.phone ?? ""
    });
  }, [profileQuery.data]);

  const channelsQuery = useQuery({
    queryKey: ["notifications", "channels"],
    enabled: tab === "notifications",
    queryFn: async () => (await apiClient.get<Envelope<Record<keyof Preferences, boolean>>>("/notifications/channels")).data.data
  });
  const preferencesQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    enabled: tab === "notifications",
    queryFn: async () => (await apiClient.get<Envelope<Preferences>>("/notifications/preferences")).data.data
  });
  const rulesQuery = useQuery({
    queryKey: ["notifications", "rules"],
    enabled: tab === "notifications",
    queryFn: async () => (await apiClient.get<Envelope<Rules>>("/notifications/rules")).data.data
  });

  useEffect(() => {
    if (preferencesQuery.data) setChannels(preferencesQuery.data);
  }, [preferencesQuery.data]);
  useEffect(() => {
    if (rulesQuery.data) setRules(rulesQuery.data);
  }, [rulesQuery.data]);

  const channelsDirty = useMemo(() => {
    if (!channels || !preferencesQuery.data) return false;
    return JSON.stringify(channels) !== JSON.stringify(preferencesQuery.data);
  }, [channels, preferencesQuery.data]);

  const profileDirty = useMemo(() => {
    const current = profileQuery.data;
    if (!current) return false;
    return (
      profile.firstName !== current.firstName ||
      profile.lastName !== current.lastName ||
      profile.email !== current.email ||
      profile.phone !== (current.phone ?? "")
    );
  }, [profile, profileQuery.data]);

  const emailChanged = Boolean(
    profileQuery.data && profile.email.trim().toLowerCase() !== profileQuery.data.email.trim().toLowerCase()
  );

  const saveProfile = useMutation({
    mutationFn: async () => {
      // Changing the sign-in email needs the current password and signs out other sessions.
      await apiClient.patch("/settings/profile", emailChanged ? { ...profile, currentPassword: emailPassword } : profile);
    },
    onSuccess: () => {
      setEmailPassword("");
      toast.success(emailChanged ? "Profile saved. Other sessions were signed out." : "Profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
    },
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not save your profile."))
  });

  const savePassword = useMutation({
    mutationFn: async () => {
      await apiClient.patch("/settings/password", {
        currentPassword: password.current,
        newPassword: password.next
      });
    },
    onSuccess: async () => {
      setPassword({ current: "", next: "", confirm: "" });
      setPasswordError(null);
      toast.success("Password updated. Other sessions were signed out.");
      if (passwordPending) {
        clearStoredPasswordPending();
        window.location.replace("/");
      }
    },
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not change your password."))
  });

  const saveChannels = useMutation({
    mutationFn: async (next: Preferences) => {
      await apiClient.patch("/notifications/preferences", next);
    },
    onSuccess: () => {
      toast.success("Notification channels saved.");
      void queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not save notification channels."))
  });

  const saveRules = useMutation({
    mutationFn: async (next: Rules) => {
      await apiClient.patch("/notifications/rules", next);
    },
    onSuccess: () => {
      toast.success("Notification rules saved.");
      void queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
    },
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not save notification rules."))
  });

  const available = visibleNotificationChannels({
    inApp: channelsQuery.data?.inApp ?? true,
    email: channelsQuery.data?.email ?? false,
    sms: channelsQuery.data?.sms ?? false,
    whatsapp: channelsQuery.data?.whatsapp ?? false,
    push: channelsQuery.data?.push ?? false
  });
  const shortcuts = settingsAdminShortcuts(role);
  const mutedMatches = MUTED_NOTIFICATION_TYPES.filter((type) => humanize(type).toLowerCase().includes(muteQuery.trim().toLowerCase()));

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    const error = passwordChangeError(password) ?? passwordStrengthError(password.next);
    setPasswordError(error);
    if (error || savePassword.isPending) return;
    savePassword.mutate();
  };

  return (
    <div className="mx-auto max-w-4xl ops-page">
      <PageBreadcrumbs />
      <header>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Your account, notifications and sign-in security.</p>
      </header>
      <div className="flex gap-6 border-b border-slate-200" role="tablist" aria-label="Settings sections">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`-mb-px min-h-11 border-b-2 px-1 text-sm ${tab === key ? "border-brand-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            onClick={() => router.replace(`${pathname}?tab=${key}` as never)}
          >
            {key === "profile" ? "Profile" : key === "notifications" ? "Notifications" : "Security"}
          </button>
        ))}
      </div>

      {profileQuery.isLoading ? <LoadingState title="Loading settings" description="Fetching your profile." /> : null}
      {passwordPending ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your account uses a temporary password. Choose a new password to continue.
        </p>
      ) : null}

      {profileQuery.error && tab !== "security" ? (
        <ErrorState title="Could not load settings" description={toSafeApiErrorMessage(profileQuery.error, "Unable to load settings.")} onRetry={() => void profileQuery.refetch()} error={profileQuery.error} />
      ) : null}

      {tab === "profile" && profileQuery.data ? (
        <div className="grid gap-5 md:grid-cols-[250px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-xl font-bold text-brand-700">
              {`${profileQuery.data.firstName[0] ?? ""}${profileQuery.data.lastName[0] ?? ""}`.toUpperCase() || "?"}
            </div>
            <p className="mt-3 font-semibold text-slate-900">{profileQuery.data.firstName} {profileQuery.data.lastName}</p>
            <p className="break-all text-xs text-slate-500">{profileQuery.data.email}</p>
            <span className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{humanize(profileQuery.data.role)}</span>
          </aside>
          <form
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!profileDirty || saveProfile.isPending) return;
              if (emailChanged && !emailPassword) {
                toast.error("Enter your current password to change your email.");
                return;
              }
              saveProfile.mutate();
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                First name
                <input value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} className={FIELD} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Last name
                <input value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} className={FIELD} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className={FIELD} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Phone
                <input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className={FIELD} />
              </label>
            </div>
            {emailChanged ? (
              <label className="block text-sm font-medium text-slate-700">
                Current password (needed to change your email)
                <PasswordInput autoComplete="current-password" value={emailPassword} onChange={setEmailPassword} />
              </label>
            ) : null}
            <p className="text-xs text-slate-500">Changing your email asks for your password and signs out your other devices.</p>
            <button type="submit" disabled={!profileDirty || saveProfile.isPending} className={PRIMARY_BTN}>
              Save changes
            </button>
          </form>
        </div>
      ) : null}

      {tab === "notifications" ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">How do you want to be told?</h2>
          {channels && available.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {available.map((key) => (
                <li key={key}>
                  <Toggle label={CHANNEL_LABELS[key]} hint={CHANNEL_HINTS[key]} checked={Boolean(channels[key])} onChange={() => setChannels({ ...channels, [key]: !channels[key] })} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">In-app notifications are available.</p>
          )}
          <button
            type="button"
            disabled={!channels || !channelsDirty || saveChannels.isPending}
            className={PRIMARY_BTN}
            onClick={() => channels && saveChannels.mutate(channels)}
          >
            Save channels
          </button>
          <details className="border-t border-slate-100 pt-3 text-sm" open>
            <summary className="cursor-pointer font-medium text-slate-800">What to be told about</summary>
            {rules ? (
              <div className="mt-2">
                <div className="divide-y divide-slate-100">
                  <Toggle label="Only urgent ones" hint="Skip routine updates" checked={rules.onlyCritical} onChange={() => setRules({ ...rules, onlyCritical: !rules.onlyCritical })} />
                  <Toggle label="Email only when overdue" hint="Other alerts stay in the app" checked={rules.emailOnlyOverdue} onChange={() => setRules({ ...rules, emailOnlyOverdue: !rules.emailOnlyOverdue })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => setMuteOpen(true)}>
                    Mute some types
                  </button>
                  <button type="button" className={PRIMARY_BTN} disabled={saveRules.isPending} onClick={() => saveRules.mutate(rules)}>
                    Save
                  </button>
                </div>
              </div>
            ) : null}
          </details>
        </section>
      ) : null}

      {tab === "security" ? (
        <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" onSubmit={submitPassword}>
          <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
              Current password
              <PasswordInput autoComplete="current-password" value={password.current} onChange={(v) => setPassword({ ...password, current: v })} />
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                New password
                <PasswordInput autoComplete="new-password" value={password.next} onChange={(v) => setPassword({ ...password, next: v })} />
              </label>
              <StrengthHint value={password.next} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Confirm new password
                <PasswordInput autoComplete="new-password" value={password.confirm} onChange={(v) => setPassword({ ...password, confirm: v })} />
              </label>
              {password.confirm ? (
                <p className={`mt-1.5 text-xs ${password.confirm === password.next ? "text-emerald-600" : "text-rose-600"}`}>
                  {password.confirm === password.next ? "✓ Matches" : "Does not match yet"}
                </p>
              ) : null}
            </div>
          </div>
          {passwordError ? <p role="alert" className="text-sm text-rose-700">{passwordError}</p> : null}
          <p className="text-xs text-slate-500">Changing your password signs out your other devices.</p>
          <button type="submit" disabled={savePassword.isPending} className={PRIMARY_BTN}>
            Update password
          </button>
        </form>
      ) : null}

      {shortcuts.length > 0 ? (
        <section className="border-t border-slate-200 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin shortcuts</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortcuts.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href as never}
                  className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
                      <ShortcutIcon label={link.label} />
                    </span>
                    {link.label}
                  </span>
                  <ChevronRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {muteOpen && rules ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="mute-title">
          <div className="w-full max-w-lg rounded-md bg-white p-4 shadow-lg">
            <h2 id="mute-title" className="text-sm font-semibold text-slate-900">Muted notifications</h2>
            <label className="mt-3 block text-sm text-slate-700">
              Search types
              <input autoFocus value={muteQuery} onChange={(event) => setMuteQuery(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
            </label>
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto">
              {mutedMatches.map((type) => {
                const muted = rules.mutedTypes.includes(type);
                return (
                  <li key={type}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={muted}
                        onChange={() =>
                          setRules({
                            ...rules,
                            mutedTypes: muted ? rules.mutedTypes.filter((item) => item !== type) : [...rules.mutedTypes, type]
                          })
                        }
                      />
                      {humanize(type)}
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setMuteOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                onClick={() => {
                  saveRules.mutate(rules, { onSuccess: () => setMuteOpen(false) });
                }}
              >
                Save muted types
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-slate-600">Loading settings.</p>}>
      <SettingsWorkspace />
    </Suspense>
  );
}
