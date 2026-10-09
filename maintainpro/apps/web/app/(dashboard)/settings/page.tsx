"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { apiClient } from "@/lib/api-client";
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

function SettingsWorkspace() {
  const user = useCurrentUser();
  const role = extractRoleName(user);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const requested = params.get("tab");
  const tab: SettingsTab = TABS.includes(requested as SettingsTab) ? (requested as SettingsTab) : "profile";

  const profileQuery = useQuery({
    queryKey: ["settings", "profile"],
    queryFn: async () => (await apiClient.get<Envelope<Profile>>("/settings/profile")).data.data
  });

  const [profile, setProfile] = useState({ firstName: "", lastName: "", email: "", phone: "" });
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

  const saveProfile = useMutation({
    mutationFn: async () => {
      await apiClient.patch("/settings/profile", profile);
    },
    onSuccess: () => {
      toast.success("Profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
    },
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not save your profile."))
  });

  const savePassword = useMutation({
    mutationFn: async () => {
      await apiClient.patch("/settings/profile", {
        currentPassword: password.current,
        newPassword: password.next
      });
    },
    onSuccess: () => {
      setPassword({ current: "", next: "", confirm: "" });
      setPasswordError(null);
      toast.success("Password updated.");
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
    const error = passwordChangeError(password);
    setPasswordError(error);
    if (error || savePassword.isPending) return;
    savePassword.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl ops-page">
      <PageBreadcrumbs />
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Your account, notification delivery, and sign-in security.</p>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
            onClick={() => router.replace(`${pathname}?tab=${key}` as never)}
          >
            {key === "profile" ? "Profile" : key === "notifications" ? "Notifications" : "Security"}
          </button>
        ))}
      </div>

      {profileQuery.isLoading ? <LoadingState title="Loading settings" description="Fetching your profile." /> : null}
      {profileQuery.error ? (
        <ErrorState title="Could not load settings" description={toSafeApiErrorMessage(profileQuery.error, "Unable to load settings.")} onRetry={() => void profileQuery.refetch()} error={profileQuery.error} />
      ) : null}

      {tab === "profile" && profileQuery.data ? (
        <form
          className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!profileDirty || saveProfile.isPending) return;
            saveProfile.mutate();
          }}
        >
          <label className="block text-sm text-slate-700">
            First name
            <input value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="block text-sm text-slate-700">
            Last name
            <input value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="block text-sm text-slate-700">
            Email
            <input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="block text-sm text-slate-700">
            Phone
            <input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <p className="text-sm text-slate-600">Role: {profileQuery.data.role}</p>
          <button type="submit" disabled={!profileDirty || saveProfile.isPending} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Save changes
          </button>
        </form>
      ) : null}

      {tab === "notifications" ? (
        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Channels</h2>
          {channels && available.length > 0 ? (
            <ul className="space-y-2">
              {available.map((key) => (
                <li key={key}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(channels[key])}
                      onChange={() => setChannels({ ...channels, [key]: !channels[key] })}
                    />
                    {CHANNEL_LABELS[key]}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">In-app notifications are available.</p>
          )}
          <button
            type="button"
            disabled={!channels || !channelsDirty || saveChannels.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            onClick={() => channels && saveChannels.mutate(channels)}
          >
            Save channels
          </button>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">Advanced preferences</summary>
            {rules ? (
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rules.onlyCritical} onChange={() => setRules({ ...rules, onlyCritical: !rules.onlyCritical })} />
                  Only critical alerts
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rules.emailOnlyOverdue} onChange={() => setRules({ ...rules, emailOnlyOverdue: !rules.emailOnlyOverdue })} />
                  Email only overdue alerts
                </label>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5" onClick={() => setMuteOpen(true)}>
                  Manage muted notifications
                </button>
                <button type="button" className="ml-2 rounded-md bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50" disabled={saveRules.isPending} onClick={() => saveRules.mutate(rules)}>
                  Save rules
                </button>
              </div>
            ) : null}
          </details>
        </section>
      ) : null}

      {tab === "security" ? (
        <form className="space-y-3 rounded-md border border-slate-200 bg-white p-4" onSubmit={submitPassword}>
          <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
          <label className="block text-sm text-slate-700">
            Current password
            <input type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="block text-sm text-slate-700">
            New password
            <input type="password" autoComplete="new-password" value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="block text-sm text-slate-700">
            Confirm new password
            <input type="password" autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          {passwordError ? <p role="alert" className="text-sm text-rose-700">{passwordError}</p> : null}
          <button type="submit" disabled={savePassword.isPending} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Update password
          </button>
        </form>
      ) : null}

      {shortcuts.length > 0 ? (
        <section className="border-t border-slate-200 pt-4">
          <h2 className="text-sm font-medium text-slate-700">Admin shortcuts</h2>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm">
            {shortcuts.map((link) => (
              <li key={link.href}>
                <Link href={link.href as never} className="text-sky-800 underline">
                  {link.label}
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
