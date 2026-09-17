import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function truncateHash(hash: string, size = 10): string {
  const raw = hash.replace(/^sha256:/, "");
  return `${raw.slice(0, size)}…`;
}
