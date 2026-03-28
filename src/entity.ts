import type { EntityDefinition } from "./types.js";

export function defineEntity<T>(
  definition: EntityDefinition<T>,
): EntityDefinition<T> {
  return definition;
}
