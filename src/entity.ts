import type { EntityDefinition } from "./types.js";
import { isNamedNodeTerm } from "./rdf.js";

export function defineEntity<T>(
  definition: EntityDefinition<T>,
): EntityDefinition<T> {
  if (typeof definition !== "object" || definition === null) {
    throw new Error(
      "defineEntity: entity definition must be a non-null object.",
    );
  }

  const entityKind =
    typeof definition?.kind === "string" && definition.kind.trim().length > 0
      ? definition.kind
      : "unknown";

  if (typeof definition?.kind !== "string" || definition.kind.trim() === "") {
    throw new Error(
      'defineEntity: entity definition is missing a non-empty "kind" string.',
    );
  }

  if (
    typeof definition.pod?.basePath !== "string" ||
    definition.pod.basePath.trim() === ""
  ) {
    throw new Error(
      `defineEntity: "${entityKind}" is missing a non-empty "pod.basePath" string.`,
    );
  }

  if (!isNamedNodeTerm(definition.rdfType)) {
    throw new Error(
      `defineEntity: "${entityKind}" is missing a valid "rdfType" named node.`,
    );
  }

  if (typeof definition.id !== "function") {
    throw new Error(
      `defineEntity: "${entityKind}" is missing an "id" function.`,
    );
  }

  if (typeof definition.toRdf !== "function") {
    throw new Error(
      `defineEntity: "${entityKind}" is missing a "toRdf" function.`,
    );
  }

  if (typeof definition.project !== "function") {
    throw new Error(
      `defineEntity: "${entityKind}" is missing a "project" function.`,
    );
  }

  return definition;
}
