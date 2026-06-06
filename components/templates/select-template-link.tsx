"use client";

import type { MouseEvent, ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";

export function SelectTemplateLink({
  children,
  href
}: {
  children: ReactNode;
  href: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const url = new URL(href, window.location.href);
    const targetId = url.hash.replace(/^#/, "");

    if (
      !targetId ||
      url.pathname !== window.location.pathname ||
      url.search !== window.location.search
    ) {
      return;
    }

    const target = document.getElementById(decodeURIComponent(targetId));

    if (!target) {
      return;
    }

    event.preventDefault();
    window.history.replaceState(null, "", url.toString());
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  return (
    <ButtonLink href={href} onClick={handleClick}>
      {children}
    </ButtonLink>
  );
}
