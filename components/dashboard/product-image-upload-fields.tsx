"use client";

import { useEffect, useState } from "react";

export function ProductImageUploadFields({
  inputId,
  name = "productImage"
}: {
  inputId: string;
  name?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="grid gap-3">
      <input
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[0.12em] file:text-white"
        id={inputId}
        name={name}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;

          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          setPreviewUrl(file ? URL.createObjectURL(file) : null);
        }}
        type="file"
      />
      {previewUrl ? (
        <img
          alt="Selected product upload preview"
          className="h-36 w-36 rounded-3xl border border-slate-200 object-cover"
          src={previewUrl}
        />
      ) : (
        <p className="text-xs font-semibold text-muted">
          Preview appears here before upload. JPG, PNG, or WebP up to 5MB.
        </p>
      )}
    </div>
  );
}
