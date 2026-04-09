import type { EngineConfig } from "../types.js";

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const MAX_POLL_INTERVAL_MS = 5 * 60_000;

type PollingManagerInput = {
  getConfig: () => EngineConfig;
  runSyncCycle: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

export function createPollingManager(input: PollingManagerInput) {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failureStreak = 0;
  let notificationsNeedRefresh = false;

  const clearTimer = (): void => {
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    timer = null;
  };

  const currentBaseInterval = (): number => {
    const interval = input.getConfig().sync?.pollIntervalMs;

    if (typeof interval !== "number" || interval <= 0) {
      return DEFAULT_POLL_INTERVAL_MS;
    }

    return interval;
  };

  const currentDelay = (): number => {
    const baseInterval = currentBaseInterval();
    const multiplier = Math.max(0, failureStreak - 1);

    return Math.min(baseInterval * 2 ** multiplier, MAX_POLL_INTERVAL_MS);
  };

  const scheduleNext = (expectedGeneration: number, delay: number): void => {
    clearTimer();

    timer = setTimeout(() => {
      void tick(expectedGeneration);
    }, delay);
  };

  const tick = async (expectedGeneration: number): Promise<void> => {
    if (generation !== expectedGeneration) {
      return;
    }

    try {
      await input.runSyncCycle();
      failureStreak = 0;

      if (notificationsNeedRefresh) {
        notificationsNeedRefresh = false;
        await input.refreshNotifications();
      }
    } catch {
      failureStreak += 1;
      notificationsNeedRefresh = true;
    }

    if (generation !== expectedGeneration) {
      return;
    }

    scheduleNext(expectedGeneration, currentDelay());
  };

  const start = (): void => {
    stop();

    const config = input.getConfig();

    if (!config.sync || !config.pod?.logBasePath) {
      return;
    }

    const currentGeneration = generation;
    scheduleNext(currentGeneration, currentBaseInterval());
  };

  const stop = (): void => {
    generation += 1;
    failureStreak = 0;
    notificationsNeedRefresh = false;
    clearTimer();
  };

  return {
    start,
    stop,
  };
}
