import { normalizeLogBasePath } from "../sync.js";
import type {
  EngineConfig,
  EntityDefinition,
  PodSyncAdapter,
} from "../types.js";

type Unsubscribe = () => Promise<void> | void;

type NotificationManagerInput = {
  entities: Map<string, EntityDefinition<unknown>>;
  getConfig: () => EngineConfig;
  runSyncNow: (suppressErrors: boolean) => Promise<void>;
};

export function createNotificationManager(input: NotificationManagerInput) {
  let generation = 0;
  let unsubscribers: Unsubscribe[] = [];

  const stop = async (): Promise<void> => {
    generation += 1;
    const current = unsubscribers;
    unsubscribers = [];
    await Promise.all(
      current.map((unsubscribe) => Promise.resolve(unsubscribe())),
    );
  };

  const start = async (): Promise<void> => {
    await stop();

    const config = input.getConfig();
    const adapter = config.sync?.adapter;
    const logBasePath = config.pod?.logBasePath;

    if (!adapter?.subscribeToContainer || !logBasePath) {
      return;
    }

    const currentGeneration = generation;
    const nextUnsubscribers: Unsubscribe[] = [];

    for (const containerPath of collectSubscriptionPaths(
      input.entities,
      adapter,
      logBasePath,
    )) {
      try {
        const subscription = await adapter.subscribeToContainer(
          containerPath,
          () => {
            if (generation !== currentGeneration) {
              return;
            }

            void input.runSyncNow(true);
          },
        );

        nextUnsubscribers.push(() => subscription.unsubscribe());
      } catch {
        // Notification subscriptions are an optimization layer only.
      }
    }

    if (generation !== currentGeneration) {
      await Promise.all(
        nextUnsubscribers.map((unsubscribe) => Promise.resolve(unsubscribe())),
      );
      return;
    }

    unsubscribers = nextUnsubscribers;
  };

  return {
    start,
    stop,
  };
}

function collectSubscriptionPaths(
  entities: Map<string, EntityDefinition<unknown>>,
  adapter: PodSyncAdapter,
  logBasePath: string,
): string[] {
  const paths = new Set<string>();

  for (const entity of entities.values()) {
    paths.add(entity.pod.basePath);
    paths.add(`${normalizeLogBasePath(logBasePath)}${entity.name}/`);
  }

  return Array.from(paths);
}
