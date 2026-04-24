"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileClock, Settings2, Shield, Sparkles, UserRoundCog, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { getStoredRole } from "@/lib/user-role";

type ApiEnvelope<T> = {
  data: T;
  meta?: {
    page?: number;
    totalPages?: number;
    total?: number;
  };
};

type SettingsTab =
  | "profile"
  | "organization"
  | "users"
  | "roles"
  | "system"
  | "notifications"
  | "audit";

type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
};

type OrganizationData = {
  tenantId: string;
  companyName: string;
  slug: string;
  timezone: string;
  currency: string;
  logoUrl: string;
};

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: {
    id: string;
    name: string;
  };
};

type RoleRow = {
  id: string;
  name: string;
  permissions: Array<PermissionRow>;
};

type PermissionRow = {
  id: string;
  key: string;
  description: string | null;
};

type NotificationPreferences = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
};

type NotificationRules = {
  mutedTypes: string[];
  onlyCritical: boolean;
  emailOnlyOverdue: boolean;
};

type AuditRow = {
  id: string;
  entity: string;
  action: string;
  createdAt: string;
  actor: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

const ROLE_OPTIONS = ["SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "DRIVER", "VIEWER"];
const NOTIFICATION_TYPES = [
  "MAINTENANCE_DUE",
  "WORK_ORDER_ASSIGNED",
  "WORK_ORDER_UPDATED",
  "LOW_STOCK",
  "VEHICLE_SERVICE_DUE",
  "LICENSE_EXPIRY",
  "INSURANCE_EXPIRY",
  "UTILITY_BILL_DUE",
  "SLA_BREACH_WARNING",
  "SYSTEM_ALERT",
  "CLEANING_VISIT_SUBMITTED",
  "CLEANING_SIGN_OFF",
  "CLEANING_REJECTED",
  "FACILITY_ISSUE_REPORTED",
  "CLEANING_MISSED",
  "CLEANING_LATE_VISIT",
  "CLEANING_HIGH_ISSUE",
  "CLEANING_SLA_BREACH"
] as const;

const profileSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional()
  })
  .refine(
    (value) => {
      if (value.newPassword && value.newPassword.length > 0) {
        return Boolean(value.currentPassword && value.currentPassword.length > 0);
      }

      return true;
    },
    {
      message: "Current password is required when changing password",
      path: ["currentPassword"]
    }
  )
  .refine(
    (value) => {
      if (value.newPassword && value.newPassword.length > 0) {
        return value.newPassword.length >= 8;
      }

      return true;
    },
    {
      message: "New password must be at least 8 characters",
      path: ["newPassword"]
    }
  );

const organizationSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  slug: z.string().trim().min(2, "Slug is required"),
  timezone: z.string().trim().min(1, "Timezone is required"),
  currency: z.string().trim().min(1, "Currency is required"),
  logoUrl: z.string().trim().optional()
});

const inviteSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  roleId: z.string().trim().min(1, "Role is required"),
  phone: z.string().optional()
});

const roleCreateSchema = z.object({
  name: z.string().trim().min(1, "Role name is required")
});

const permissionCreateSchema = z.object({
  key: z.string().trim().min(2, "Permission key is required"),
  description: z.string().optional()
});

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (char) => char.toUpperCase());
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const candidate = error as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
      message?: string;
    };

    const message = candidate.response?.data?.message;
    if (Array.isArray(message) && message.length > 0) {
      return String(message[0]);
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
  }

  return fallback;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [auditPage, setAuditPage] = useState(1);

  const [systemDraft, setSystemDraft] = useState("{}");
  const [integrationsDraft, setIntegrationsDraft] = useState("{}");
  const [automationDraft, setAutomationDraft] = useState("[]");
  const [digestDraft, setDigestDraft] = useState("[]");

  const role = useMemo(() => getStoredRole(), []);
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      currentPassword: "",
      newPassword: ""
    }
  });

  const organizationForm = useForm<z.infer<typeof organizationSchema>>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      companyName: "",
      slug: "",
      timezone: "UTC",
      currency: "USD",
      logoUrl: ""
    }
  });

  const inviteForm = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleId: "",
      phone: ""
    }
  });

  const roleCreateForm = useForm<z.infer<typeof roleCreateSchema>>({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: {
      name: "MANAGER"
    }
  });

  const permissionCreateForm = useForm<z.infer<typeof permissionCreateSchema>>({
    resolver: zodResolver(permissionCreateSchema),
    defaultValues: {
      key: "",
      description: ""
    }
  });

  const profileQuery = useQuery({
    queryKey: ["settings", "profile"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<ProfileData>>("/settings/profile");
      return response.data.data;
    }
  });

  const organizationQuery = useQuery({
    queryKey: ["settings", "organization"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<OrganizationData>>("/settings/organization");
      return response.data.data;
    }
  });

  const systemQuery = useQuery({
    queryKey: ["settings", "system"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<Record<string, unknown>>>("/settings/system");
      return response.data.data;
    }
  });

  const integrationsQuery = useQuery({
    queryKey: ["settings", "integrations"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<Record<string, unknown>>>("/settings/integrations");
      return response.data.data;
    }
  });

  const featureToggleQuery = useQuery({
    queryKey: ["settings", "feature-toggles"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<Record<string, boolean>>>(
        "/settings/feature-toggles"
      );
      return response.data.data;
    }
  });

  const automationQuery = useQuery({
    queryKey: ["settings", "automation-rules"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<Array<Record<string, unknown>>>>(
        "/settings/automation-rules"
      );
      return response.data.data;
    }
  });

  const digestQuery = useQuery({
    queryKey: ["settings", "digest-schedules"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<Array<Record<string, unknown>>>>(
        "/settings/digest-schedules"
      );
      return response.data.data;
    }
  });

  const usersQuery = useQuery({
    queryKey: ["settings", "users"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<UserRow[]>>("/users");
      return response.data.data;
    }
  });

  const rolesQuery = useQuery({
    queryKey: ["settings", "roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<RoleRow[]>>("/roles");
      return response.data.data;
    }
  });

  const permissionsQuery = useQuery({
    queryKey: ["settings", "permissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<PermissionRow[]>>("/roles/permissions");
      return response.data.data;
    }
  });

  const notificationPreferencesQuery = useQuery({
    queryKey: ["settings", "notification-preferences"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationPreferences>>(
        "/notifications/preferences"
      );
      return response.data.data;
    }
  });

  const notificationRulesQuery = useQuery({
    queryKey: ["settings", "notification-rules"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationRules>>("/notifications/rules");
      return response.data.data;
    }
  });

  const auditQuery = useQuery({
    queryKey: ["settings", "audit", auditPage],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<AuditRow[]>>("/settings/audit-logs", {
        params: {
          page: auditPage,
          pageSize: 15
        }
      });

      return {
        items: response.data.data,
        meta: {
          page: Number(response.data.meta?.page ?? 1),
          totalPages: Number(response.data.meta?.totalPages ?? 1),
          total: Number(response.data.meta?.total ?? 0)
        }
      };
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof profileSchema>) => {
      await apiClient.patch("/settings/profile", payload);
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
      profileForm.reset({
        ...profileForm.getValues(),
        currentPassword: "",
        newPassword: ""
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update profile."));
    }
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof organizationSchema>) => {
      await apiClient.patch("/settings/organization", payload);
    },
    onSuccess: () => {
      toast.success("Organization settings updated.");
      queryClient.invalidateQueries({ queryKey: ["settings", "organization"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update organization settings."));
    }
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof inviteSchema>) => {
      await apiClient.post("/users/invite", payload);
    },
    onSuccess: () => {
      toast.success("User invited.");
      inviteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to invite user."));
    }
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async (payload: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/users/${payload.id}/status`, { isActive: payload.isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update user status."));
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => {
      toast.success("User deleted.");
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to delete user."));
    }
  });

  const createRoleMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof roleCreateSchema>) => {
      await apiClient.post("/roles", payload);
    },
    onSuccess: () => {
      toast.success("Role created.");
      queryClient.invalidateQueries({ queryKey: ["settings", "roles"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to create role."));
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      toast.success("Role deleted.");
      queryClient.invalidateQueries({ queryKey: ["settings", "roles"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to delete role."));
    }
  });

  const createPermissionMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof permissionCreateSchema>) => {
      await apiClient.post("/roles/permissions", payload);
    },
    onSuccess: () => {
      toast.success("Permission created.");
      permissionCreateForm.reset();
      queryClient.invalidateQueries({ queryKey: ["settings", "permissions"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to create permission."));
    }
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async (payload: { roleId: string; permissionIds: string[] }) => {
      await apiClient.patch(`/roles/${payload.roleId}`, {
        permissionIds: payload.permissionIds
      });
    },
    onSuccess: () => {
      toast.success("Role permissions updated.");
      queryClient.invalidateQueries({ queryKey: ["settings", "roles"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update role permissions."));
    }
  });

  const saveSystemMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await apiClient.patch("/settings/system", payload);
    },
    onSuccess: () => {
      toast.success("System configuration saved.");
      queryClient.invalidateQueries({ queryKey: ["settings", "system"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save system configuration."));
    }
  });

  const saveIntegrationsMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await apiClient.patch("/settings/integrations", payload);
    },
    onSuccess: () => {
      toast.success("Integration settings saved.");
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save integration settings."));
    }
  });

  const updateFeatureToggleMutation = useMutation({
    mutationFn: async (payload: Record<string, boolean>) => {
      await apiClient.patch("/settings/feature-toggles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "feature-toggles"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update feature toggles."));
    }
  });

  const saveAutomationMutation = useMutation({
    mutationFn: async (payload: Array<Record<string, unknown>>) => {
      await apiClient.patch("/settings/automation-rules", { rules: payload });
    },
    onSuccess: () => {
      toast.success("Automation rules saved.");
      queryClient.invalidateQueries({ queryKey: ["settings", "automation-rules"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save automation rules."));
    }
  });

  const saveDigestMutation = useMutation({
    mutationFn: async (payload: Array<Record<string, unknown>>) => {
      await apiClient.patch("/settings/digest-schedules", { schedules: payload });
    },
    onSuccess: () => {
      toast.success("Digest schedules saved.");
      queryClient.invalidateQueries({ queryKey: ["settings", "digest-schedules"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save digest schedules."));
    }
  });

  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: async (payload: Partial<NotificationPreferences>) => {
      await apiClient.patch("/notifications/preferences", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "notification-preferences"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update notification preferences."));
    }
  });

  const updateNotificationRulesMutation = useMutation({
    mutationFn: async (payload: Partial<NotificationRules>) => {
      await apiClient.patch("/notifications/rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "notification-rules"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update notification rules."));
    }
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    profileForm.reset({
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      email: profileQuery.data.email,
      phone: profileQuery.data.phone ?? "",
      currentPassword: "",
      newPassword: ""
    });
  }, [profileQuery.data, profileForm]);

  useEffect(() => {
    if (!organizationQuery.data) {
      return;
    }

    organizationForm.reset({
      companyName: organizationQuery.data.companyName,
      slug: organizationQuery.data.slug,
      timezone: organizationQuery.data.timezone,
      currency: organizationQuery.data.currency,
      logoUrl: organizationQuery.data.logoUrl
    });
  }, [organizationQuery.data, organizationForm]);

  useEffect(() => {
    if (systemQuery.data) {
      setSystemDraft(JSON.stringify(systemQuery.data, null, 2));
    }
  }, [systemQuery.data]);

  useEffect(() => {
    if (integrationsQuery.data) {
      setIntegrationsDraft(JSON.stringify(integrationsQuery.data, null, 2));
    }
  }, [integrationsQuery.data]);

  useEffect(() => {
    if (automationQuery.data) {
      setAutomationDraft(JSON.stringify(automationQuery.data, null, 2));
    }
  }, [automationQuery.data]);

  useEffect(() => {
    if (digestQuery.data) {
      setDigestDraft(JSON.stringify(digestQuery.data, null, 2));
    }
  }, [digestQuery.data]);

  const tabs: Array<{ key: SettingsTab; label: string; icon: JSX.Element; adminOnly?: boolean }> = [
    { key: "profile", label: "Profile", icon: <UserRoundCog size={16} /> },
    { key: "organization", label: "Organization", icon: <Building2 size={16} />, adminOnly: true },
    { key: "users", label: "Users", icon: <Users size={16} />, adminOnly: true },
    { key: "roles", label: "Roles", icon: <Shield size={16} />, adminOnly: true },
    { key: "system", label: "System", icon: <Settings2 size={16} />, adminOnly: true },
    { key: "notifications", label: "Notifications", icon: <Sparkles size={16} /> },
    { key: "audit", label: "Audit", icon: <FileClock size={16} />, adminOnly: true }
  ];

  return (
    <div className="space-y-5">
      <section className="card bg-gradient-to-r from-indigo-900 via-sky-900 to-cyan-800 text-white">
        <h2 className="text-2xl font-semibold tracking-tight">Settings Command Center</h2>
        <p className="mt-1 text-sm text-slate-200">
          Configure identity, tenant defaults, automation rules, feature flags, and governance controls.
        </p>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex min-w-max items-center gap-2">
          {tabs
            .filter((tab) => !tab.adminOnly || isAdmin)
            .map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
        </div>
      </section>

      {activeTab === "profile" ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">User Profile</h3>
            <span className="text-xs text-slate-500">Role: {profileQuery.data?.role ?? role}</span>
          </div>
          <form
            onSubmit={profileForm.handleSubmit((values) => updateProfileMutation.mutate(values))}
            className="grid gap-3 md:grid-cols-2"
          >
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">First Name</span>
              <input {...profileForm.register("firstName")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="text-xs text-rose-600">{profileForm.formState.errors.firstName?.message}</p>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Last Name</span>
              <input {...profileForm.register("lastName")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="text-xs text-rose-600">{profileForm.formState.errors.lastName?.message}</p>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Email</span>
              <input {...profileForm.register("email")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="text-xs text-rose-600">{profileForm.formState.errors.email?.message}</p>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Phone</span>
              <input {...profileForm.register("phone")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="text-xs text-rose-600">{profileForm.formState.errors.phone?.message}</p>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Current Password</span>
              <input type="password" {...profileForm.register("currentPassword")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="text-xs text-rose-600">{profileForm.formState.errors.currentPassword?.message}</p>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">New Password</span>
              <input type="password" {...profileForm.register("newPassword")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="text-xs text-rose-600">{profileForm.formState.errors.newPassword?.message}</p>
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Profile
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === "organization" && isAdmin ? (
        <section className="card space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Organization Settings</h3>
          <form
            onSubmit={organizationForm.handleSubmit((values) => updateOrganizationMutation.mutate(values))}
            className="grid gap-3 md:grid-cols-2"
          >
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Company Name</span>
              <input {...organizationForm.register("companyName")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Slug</span>
              <input {...organizationForm.register("slug")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Timezone</span>
              <input {...organizationForm.register("timezone")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Currency</span>
              <input {...organizationForm.register("currency")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-600">Logo URL</span>
              <input {...organizationForm.register("logoUrl")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={updateOrganizationMutation.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Organization
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === "users" && isAdmin ? (
        <section className="space-y-4">
          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Invite User</h3>
            <form
              onSubmit={inviteForm.handleSubmit((values) => inviteUserMutation.mutate(values))}
              className="grid gap-3 md:grid-cols-2"
            >
              <input placeholder="First name" {...inviteForm.register("firstName")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input placeholder="Last name" {...inviteForm.register("lastName")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input placeholder="Email" {...inviteForm.register("email")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select {...inviteForm.register("roleId")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select role</option>
                {(rolesQuery.data ?? []).map((roleItem) => (
                  <option key={roleItem.id} value={roleItem.id}>
                    {roleItem.name}
                  </option>
                ))}
              </select>
              <input placeholder="Phone (optional)" {...inviteForm.register("phone")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                  Send Invite
                </button>
              </div>
            </form>
          </article>

          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Users</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">Role</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersQuery.data ?? []).map((user) => (
                    <tr key={user.id} className="border-t border-slate-200">
                      <td className="px-2 py-2">
                        <p className="font-medium text-slate-900">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-2 py-2">{humanize(user.role.name)}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateUserStatusMutation.mutate({
                                id: user.id,
                                isActive: !user.isActive
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => deleteUserMutation.mutate(user.id)}
                            className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "roles" && isAdmin ? (
        <section className="space-y-4">
          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Role Management</h3>
            <form onSubmit={roleCreateForm.handleSubmit((values) => createRoleMutation.mutate(values))} className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Create Role</span>
                <select {...roleCreateForm.register("name")} className="rounded-lg border border-slate-300 px-3 py-2">
                  {ROLE_OPTIONS.map((roleName) => (
                    <option key={roleName} value={roleName}>
                      {humanize(roleName)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Create Role
              </button>
            </form>

            <form
              onSubmit={permissionCreateForm.handleSubmit((values) => createPermissionMutation.mutate(values))}
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <input placeholder="Permission key (e.g. assets.manage)" {...permissionCreateForm.register("key")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input placeholder="Description" {...permissionCreateForm.register("description")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Add Permission
              </button>
            </form>
          </article>

          <article className="card space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Existing Roles</h4>
            <div className="space-y-3">
              {(rolesQuery.data ?? []).map((roleItem) => {
                const selectedPermissionIds = new Set(roleItem.permissions.map((item) => item.id));

                return (
                  <div key={roleItem.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{humanize(roleItem.name)}</p>
                      <button
                        onClick={() => deleteRoleMutation.mutate(roleItem.id)}
                        className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {(permissionsQuery.data ?? []).map((permission) => {
                        const checked = selectedPermissionIds.has(permission.id);

                        return (
                          <label key={permission.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">
                            <span>{permission.key}</span>
                            <input
                              type="checkbox"
                              defaultChecked={checked}
                              onChange={(event) => {
                                const next = new Set(selectedPermissionIds);

                                if (event.target.checked) {
                                  next.add(permission.id);
                                } else {
                                  next.delete(permission.id);
                                }

                                updateRolePermissionsMutation.mutate({
                                  roleId: roleItem.id,
                                  permissionIds: [...next]
                                });
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "system" && isAdmin ? (
        <section className="space-y-4">
          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">System Configuration JSON</h3>
            <textarea
              value={systemDraft}
              onChange={(event) => setSystemDraft(event.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(systemDraft) as Record<string, unknown>;
                    saveSystemMutation.mutate(parsed);
                  } catch {
                    toast.error("System configuration must be valid JSON.");
                  }
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save System JSON
              </button>
            </div>
          </article>

          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Integrations JSON</h3>
            <textarea
              value={integrationsDraft}
              onChange={(event) => setIntegrationsDraft(event.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(integrationsDraft) as Record<string, unknown>;
                    saveIntegrationsMutation.mutate(parsed);
                  } catch {
                    toast.error("Integrations payload must be valid JSON.");
                  }
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save Integrations JSON
              </button>
            </div>
          </article>

          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Feature Toggles</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(featureToggleQuery.data ?? {}).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>{humanize(key)}</span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() =>
                      updateFeatureToggleMutation.mutate({
                        [key]: !value
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Automation Rules JSON</h3>
            <textarea
              value={automationDraft}
              onChange={(event) => setAutomationDraft(event.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(automationDraft) as Array<Record<string, unknown>>;
                    saveAutomationMutation.mutate(parsed);
                  } catch {
                    toast.error("Automation rules must be a valid JSON array.");
                  }
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save Automation Rules
              </button>
            </div>
          </article>

          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Digest Schedules JSON</h3>
            <textarea
              value={digestDraft}
              onChange={(event) => setDigestDraft(event.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(digestDraft) as Array<Record<string, unknown>>;
                    saveDigestMutation.mutate(parsed);
                  } catch {
                    toast.error("Digest schedules must be a valid JSON array.");
                  }
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save Digest Schedules
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "notifications" ? (
        <section className="space-y-4">
          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Notification Channel Preferences</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(notificationPreferencesQuery.data ?? {}).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>{humanize(key)}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={() =>
                      updateNotificationPreferencesMutation.mutate({
                        [key]: !value
                      } as Partial<NotificationPreferences>)
                    }
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="card space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Notification Automation Rules</h3>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>Only critical alerts</span>
              <input
                type="checkbox"
                checked={Boolean(notificationRulesQuery.data?.onlyCritical)}
                onChange={() =>
                  updateNotificationRulesMutation.mutate({
                    onlyCritical: !notificationRulesQuery.data?.onlyCritical
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>Email only overdue alerts</span>
              <input
                type="checkbox"
                checked={Boolean(notificationRulesQuery.data?.emailOnlyOverdue)}
                onChange={() =>
                  updateNotificationRulesMutation.mutate({
                    emailOnlyOverdue: !notificationRulesQuery.data?.emailOnlyOverdue
                  })
                }
              />
            </label>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Muted Notification Types</p>
              <div className="mt-2 max-h-60 space-y-1 overflow-auto pr-1">
                {NOTIFICATION_TYPES.map((entry) => {
                  const muted = notificationRulesQuery.data?.mutedTypes?.includes(entry) ?? false;

                  return (
                    <label key={entry} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 text-xs text-slate-700">
                      <span>{humanize(entry)}</span>
                      <input
                        type="checkbox"
                        checked={muted}
                        onChange={() => {
                          const current = notificationRulesQuery.data?.mutedTypes ?? [];
                          const next = muted
                            ? current.filter((item) => item !== entry)
                            : [...current, entry];

                          updateNotificationRulesMutation.mutate({ mutedTypes: next });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "audit" && isAdmin ? (
        <section className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Settings Audit Logs</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Entity</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Actor</th>
                </tr>
              </thead>
              <tbody>
                {(auditQuery.data?.items ?? []).map((log) => (
                  <tr key={log.id} className="border-t border-slate-200">
                    <td className="px-2 py-2 text-xs text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2 text-sm font-medium text-slate-800">{humanize(log.entity)}</td>
                    <td className="px-2 py-2 text-sm text-slate-700">{humanize(log.action)}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{log.actor ? `${log.actor.firstName} ${log.actor.lastName} (${log.actor.email})` : "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {auditQuery.data?.meta.page ?? 1} of {auditQuery.data?.meta.totalPages ?? 1} ({auditQuery.data?.meta.total ?? 0} logs)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuditPage((page) => Math.max(1, page - 1))}
                disabled={(auditQuery.data?.meta.page ?? 1) <= 1}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setAuditPage((page) => Math.min(auditQuery.data?.meta.totalPages ?? page + 1, page + 1))}
                disabled={(auditQuery.data?.meta.page ?? 1) >= (auditQuery.data?.meta.totalPages ?? 1)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
