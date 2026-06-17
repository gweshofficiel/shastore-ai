"use client";

type TemplateScreenshotUploadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  registryId: string;
  templateName: string;
};

const screenshotTypes = [
  { label: "Desktop", value: "desktop" },
  { label: "Mobile", value: "mobile" },
  { label: "Tablet", value: "tablet" },
  { label: "Thumbnail", value: "thumbnail" },
  { label: "Hero", value: "hero" },
  { label: "Gallery", value: "gallery" }
] as const;

export function TemplateScreenshotUploadForm({
  action,
  registryId,
  templateName
}: TemplateScreenshotUploadFormProps) {
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input name="registryId" type="hidden" value={registryId} />
      <input name="templateName" type="hidden" value={templateName} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Screenshot type
        <select
          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
          defaultValue="gallery"
          name="screenshotType"
        >
          {screenshotTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Screenshot file (PNG, JPG, WEBP — max 8 MB)
        <input
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          className="block w-full text-xs font-semibold text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.14em] file:text-white"
          name="screenshotFile"
          required
          type="file"
        />
      </label>
      <button
        className="h-9 rounded-full border border-slate-200 bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
        type="submit"
      >
        Upload screenshot
      </button>
    </form>
  );
}
