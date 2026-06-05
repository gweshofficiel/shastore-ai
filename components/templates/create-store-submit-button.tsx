"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function CreateStoreSubmitButton({
  className = "",
  label = "Apply template and create store",
  pendingLabel = "Creating store..."
}: {
  className?: string;
  label?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending}
      className={className}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
