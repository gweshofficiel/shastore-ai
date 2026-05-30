"use client";

import { useRef, useState } from "react";

const toolbarButtonClass =
  "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-400";

export function RichTextEditor({
  defaultValue = "",
  id,
  name
}: {
  defaultValue?: string | null;
  id: string;
  name: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");

  function syncValue() {
    setValue(editorRef.current?.innerHTML ?? "");
  }

  function run(command: string, argument?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    syncValue();
  }

  function addLink() {
    const url = window.prompt("Enter link URL");
    if (url) {
      run("createLink", url);
    }
  }

  function addImage() {
    const url = window.prompt("Enter image URL");
    if (url) {
      run("insertImage", url);
    }
  }

  return (
    <div className="grid gap-3">
      <input name={name} type="hidden" value={value} />
      <div className="flex flex-wrap gap-2" aria-label="Rich text toolbar">
        <button className={toolbarButtonClass} onClick={() => run("formatBlock", "h2")} type="button">
          Heading
        </button>
        <button className={toolbarButtonClass} onClick={() => run("formatBlock", "p")} type="button">
          Paragraph
        </button>
        <button className={toolbarButtonClass} onClick={() => run("bold")} type="button">
          Bold
        </button>
        <button className={toolbarButtonClass} onClick={() => run("italic")} type="button">
          Italic
        </button>
        <button className={toolbarButtonClass} onClick={() => run("insertUnorderedList")} type="button">
          List
        </button>
        <button className={toolbarButtonClass} onClick={addLink} type="button">
          Link
        </button>
        <button className={toolbarButtonClass} onClick={addImage} type="button">
          Image
        </button>
      </div>
      <div
        aria-label="Page content"
        className="min-h-64 rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-7 text-ink shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        contentEditable
        dangerouslySetInnerHTML={{ __html: defaultValue ?? "" }}
        id={id}
        onBlur={syncValue}
        onInput={syncValue}
        suppressContentEditableWarning
      />
      <p className="text-xs font-semibold text-muted">
        Supports headings, paragraphs, lists, links, images, and basic formatting.
      </p>
    </div>
  );
}
