const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 } as const;

/** Parses "30s", "15m", "12h", "7d" or "2w" into milliseconds (the formats config accepts). */
export const parseDurationMs = (value: string): number => {
  const match = /^(\d+)([smhdw])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
};
