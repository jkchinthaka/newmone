"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldOff,
  type LucideIcon
} from "lucide-react";

import {
  DEFAULT_PAGE_ERROR_MESSAGE,
  toSafeDisplayMessage
} from "@/lib/safe-display-message";
import { getApiErrorMessage } from "@/lib/api-client";

export { DEFAULT_PAGE_ERROR_MESSAGE, toSafeDisplayMessage };

export function toSafeApiErrorMessage(
  error: unknown,
  fallback = DEFAULT_PAGE_ERROR_MESSAGE
): string {
  return toSafeDisplayMessage(getApiErrorMessage(error, fallback), fallback);
}

const DEFAULT_PERMISSION_MESSAGE = "You do not have access to this area.";

type PageStateShellProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert" | "region";
  ariaLive?: "polite" | "assertive" | "off";
};

function PageStateShell({
  title,
  description,
  icon: Icon,
  iconClassName = "text-brand-600",
  children,
  className = "",
  role = "region",
  ariaLive
}: PageStateShellProps) {
  return (
    <section
      aria-live={ariaLive}
      className={`rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm ${className}`.trim()}
      role={role}
    >
      {Icon ? <Icon aria-hidden className={`mx-auto h-8 w-8 ${iconClassName}`} /> : null}
      <h2 className="mt-3 text-sm font-semibold text-slate-900">{title}</h2>
      {description ? (
        <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
      {children ? <div className="mt-4 flex flex-col items-center gap-3">{children}</div> : null}
    </section>
  );
}

type LoadingStateProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function LoadingState({
  title = "Loading",
  description = "Please wait while we prepare this view.",
  children
}: LoadingStateProps) {
  return (
    <PageStateShell
      ariaLive="polite"
      description={description}
      role="status"
      title={title}
    >
      {children ?? <Loader2 aria-hidden className="h-6 w-6 animate-spin text-brand-600" />}
    </PageStateShell>
  );
}

type ErrorStateProps = {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title = "Unable to load this view",
  description,
  error,
  onRetry,
  retryLabel = "Try again"
}: ErrorStateProps) {
  const safeDescription =
    description ??
    (error !== undefined
      ? toSafeApiErrorMessage(error, DEFAULT_PAGE_ERROR_MESSAGE)
      : DEFAULT_PAGE_ERROR_MESSAGE);

  return (
    <PageStateShell
      ariaLive="assertive"
      description={safeDescription}
      icon={AlertTriangle}
      iconClassName="text-rose-500"
      role="alert"
      title={title}
    >
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <RefreshCw aria-hidden size={15} />
          {retryLabel}
        </button>
      ) : null}
    </PageStateShell>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <PageStateShell description={description} icon={Inbox} iconClassName="text-slate-400" title={title}>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {actionLabel}
        </button>
      ) : null}
    </PageStateShell>
  );
}

type SuccessStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SuccessState({ title, description, actionLabel, onAction }: SuccessStateProps) {
  return (
    <PageStateShell
      description={description}
      icon={CheckCircle2}
      iconClassName="text-emerald-600"
      title={title}
    >
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          {actionLabel}
        </button>
      ) : null}
    </PageStateShell>
  );
}

type PermissionStateProps = {
  title?: string;
  description?: string;
};

export function PermissionState({
  title = "Access restricted",
  description = DEFAULT_PERMISSION_MESSAGE
}: PermissionStateProps) {
  return (
    <PageStateShell
      description={description}
      icon={ShieldOff}
      iconClassName="text-amber-600"
      title={title}
    />
  );
}

export function LoadingCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function InlineLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500"
      role="status"
      aria-live="polite"
    >
      <Loader2 aria-hidden className="h-4 w-4 animate-spin text-brand-600" />
      <span>{label}</span>
    </div>
  );
}
