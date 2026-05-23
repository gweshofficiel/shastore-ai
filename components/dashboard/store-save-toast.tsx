"use client";

import { useEffect, useState } from "react";

type StoreSaveToastProps = {
  message: string;
  show: boolean;
};

export function StoreSaveToast({ message, show }: StoreSaveToastProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [show]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-lg"
      role="status"
    >
      <p className="text-sm font-bold text-emerald-800">{message}</p>
    </div>
  );
}
