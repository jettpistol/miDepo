import type { Tone } from "@/components/ui";

export const TRANSFER_STATE: Record<"sending" | "away" | "closed", { label: string; tone: Tone }> = {
  sending: { label: "Preparando", tone: "accent" },
  away: { label: "Afuera", tone: "warn" },
  closed: { label: "Cerrada", tone: "ok" },
};
