import type { Logger } from "./types.js";

export function nowMs(): number {
  return Date.now();
}

export function durationSince(startMs: number): number {
  return Math.max(0, nowMs() - startMs);
}

export function logDebug(
  logger: Logger | undefined,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  if (!logger) {
    return;
  }

  logger.debug(message, metadata);
}

export function logInfo(
  logger: Logger | undefined,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  if (!logger) {
    return;
  }

  logger.info(message, metadata);
}

export function logWarn(
  logger: Logger | undefined,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  if (!logger) {
    return;
  }

  logger.warn(message, metadata);
}
