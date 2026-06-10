"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginSessionReset() {
  useEffect(() => {
    const supabase = createClient({ role: "admin" });

    void supabase.auth.signOut();
  }, []);

  return null;
}
