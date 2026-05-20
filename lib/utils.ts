import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getPublicUrl } from "@/lib/deployment/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path = "") {
  return getPublicUrl(path);
}
