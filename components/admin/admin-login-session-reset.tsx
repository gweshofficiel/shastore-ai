"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginSessionReset() {
  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.signOut();
  }, []);

  return null;
}
