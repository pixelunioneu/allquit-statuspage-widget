import type { WidgetStrings } from './strings';
import { DEFAULT_STRINGS } from './strings';

export type WidgetPosition = 'bottom-right' | 'bottom-left';

/** Public options accepted by AllQuietStatusWidget.init() and data-* attributes. */
export interface WidgetOptions {
  statusUrl?: string;
  statusPageUrl?: string;
  pollIntervalSeconds?: number;
  position?: string;
  maintenanceLookaheadMinutes?: number;
  zIndex?: number;
  strings?: Partial<WidgetStrings>;
}

export interface WidgetConfig {
  statusUrl: string;
  statusPageUrl?: string;
  pollIntervalMs: number;
  position: WidgetPosition;
  lookaheadMs: number;
  zIndex: number;
  strings: WidgetStrings;
}

export const MIN_POLL_INTERVAL_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 300_000;
const DEFAULT_LOOKAHEAD_MS = 3_600_000;
const DEFAULT_Z_INDEX = 2_147_483_000;

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Returns null when the required statusUrl is missing. */
export function normalizeOptions(options: WidgetOptions): WidgetConfig | null {
  if (typeof options.statusUrl !== 'string' || options.statusUrl.trim() === '') return null;
  return {
    statusUrl: options.statusUrl.trim(),
    statusPageUrl:
      typeof options.statusPageUrl === 'string' && options.statusPageUrl.trim() !== ''
        ? options.statusPageUrl.trim()
        : undefined,
    pollIntervalMs: Math.max(
      MIN_POLL_INTERVAL_MS,
      finiteOr(options.pollIntervalSeconds, DEFAULT_POLL_INTERVAL_MS / 1000) * 1000,
    ),
    position: options.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
    lookaheadMs: Math.max(
      0,
      finiteOr(options.maintenanceLookaheadMinutes, DEFAULT_LOOKAHEAD_MS / 60_000) * 60_000,
    ),
    zIndex: Math.trunc(finiteOr(options.zIndex, DEFAULT_Z_INDEX)),
    strings: { ...DEFAULT_STRINGS, ...(options.strings ?? {}) },
  };
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads data-* attributes off the embedding <script> tag. */
export function optionsFromScript(script: HTMLScriptElement): WidgetOptions {
  const d = script.dataset;
  return {
    statusUrl: d.statusUrl,
    statusPageUrl: d.statusPageUrl,
    pollIntervalSeconds: parseNumber(d.pollInterval),
    position: d.position,
    maintenanceLookaheadMinutes: parseNumber(d.maintenanceLookahead),
    zIndex: parseNumber(d.zIndex),
  };
}
