"use client";

export function ReceiptPrintButton() {
  return (
    <button
      className="rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      Print receipt
    </button>
  );
}
