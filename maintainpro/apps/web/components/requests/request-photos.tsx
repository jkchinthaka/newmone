"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  DEFAULT_MAX_REQUEST_PHOTOS,
  deleteRequestPhoto,
  fetchRequestPhotoUrl,
  uploadRequestPhoto,
  type RequestPhotoRef
} from "@/lib/request-photos";

/** Optional photos picked in the Report a problem wizard. They are uploaded once the request exists. */
export function PendingPhotoPicker({
  files,
  onChange,
  max = DEFAULT_MAX_REQUEST_PHOTOS,
  disabled = false,
  disabledNote
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">
          Photos <span className="font-normal text-slate-500">(optional, up to {max})</span>
        </p>
        <button
          type="button"
          disabled={disabled || files.length >= max}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:opacity-50"
        >
          <Camera size={16} aria-hidden /> Add photo
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Add photos"
        tabIndex={-1}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
          event.target.value = "";
          if (picked.length === 0) return;
          onChange([...files, ...picked].slice(0, max));
        }}
      />
      {disabledNote ? <p className="text-xs text-slate-500">{disabledNote}</p> : null}
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previews[index] ? <img src={previews[index]} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" /> : null}
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => onChange(files.filter((_, position) => position !== index))}
                className="absolute right-0.5 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PhotoThumb({ requestId, photo, canRemove, busy, onRemove }: { requestId: string; photo: RequestPhotoRef; canRemove: boolean; busy: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let created: string | null = null;
    void fetchRequestPhotoUrl(requestId, photo.id)
      .then((next) => {
        if (revoked) URL.revokeObjectURL(next);
        else {
          created = next;
          setUrl(next);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [requestId, photo.id]);

  return (
    <li className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${photo.fileName}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={photo.fileName} className="h-full w-full object-cover" />
        </a>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">
          {failed ? "Unavailable" : <Loader2 size={16} className="animate-spin" aria-label="Loading photo" />}
        </span>
      )}
      {canRemove ? (
        <button
          type="button"
          disabled={busy}
          aria-label={`Remove ${photo.fileName}`}
          onClick={onRemove}
          className="absolute right-0.5 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white disabled:opacity-50"
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/** Photos on the request page: everyone who can see the request sees them; the reporter and reviewers can add or remove. */
export function RequestPhotosPanel({
  requestId,
  photos,
  canEdit,
  userId,
  isReviewer,
  max = DEFAULT_MAX_REQUEST_PHOTOS,
  onChanged
}: {
  requestId: string;
  photos: RequestPhotoRef[];
  canEdit: boolean;
  userId?: string | null;
  isReviewer: boolean;
  max?: number;
  onChanged: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    let failed: string | null = null;
    for (const file of files.slice(0, Math.max(0, max - photos.length))) {
      const result = await uploadRequestPhoto(requestId, file);
      if (!result.ok) failed = result.message;
    }
    setBusy(false);
    if (failed) toast.error(failed);
    else toast.success("Photo added");
    await onChanged();
  }

  async function remove(photo: RequestPhotoRef) {
    setBusy(true);
    try {
      await deleteRequestPhoto(requestId, photo.id);
      toast.success("Photo removed");
      await onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "The photo could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  if (photos.length === 0 && !canEdit) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Photos">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Photos</h2>
        {canEdit ? (
          <>
            <button
              type="button"
              disabled={busy || photos.length >= max}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />} Add photo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label="Add photos to this request"
              tabIndex={-1}
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
                event.target.value = "";
                void add(picked);
              }}
            />
          </>
        ) : null}
      </div>
      {photos.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No photos yet. A picture of the problem helps the maintenance team.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              requestId={requestId}
              photo={photo}
              busy={busy}
              canRemove={canEdit && (isReviewer || (Boolean(userId) && photo.uploadedById === userId))}
              onRemove={() => void remove(photo)}
            />
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">Photos are optional. Up to {max} per request.</p>
    </section>
  );
}
