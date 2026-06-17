"use client";

type TemplateAssetUploadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  registryId: string;
  templateName: string;
};

const assetTypes = [
  { label: "Preview image", value: "preview_image" },
  { label: "Icon", value: "icon" },
  { label: "Demo media", value: "demo_media" },
  { label: "Package file (JSON)", value: "package_file" },
  { label: "Documentation", value: "documentation" },
  { label: "Custom", value: "custom" }
] as const;

export function TemplateAssetUploadForm({ action, registryId, templateName }: TemplateAssetUploadFormProps) {
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input name="registryId" type="hidden" value={registryId} />
      <input name="templateName" type="hidden" value={templateName} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Asset type
        <select
          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
          defaultValue="preview_image"
          name="assetType"
        >
          {assetTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] font-semibold text-slate-500">
        Screenshots use the Screenshot Management workflow. Images up to 8 MB; documentation up to 10 MB; JSON package
        metadata up to 2 MB.
      </p>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Asset file
        <input
          className="block w-full text-xs font-semibold text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.14em] file:text-white"
          name="assetFile"
          required
          type="file"
        />
      </label>
      <button
        className="h-9 rounded-full border border-slate-200 bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.14em] text-white"
        type="submit"
      >
        Upload asset
      </button>
    </form>
  );
}
