import type { NamedNode } from "n3";

import { uri } from "./rdf.js";

export const rdf = {
  type: uri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
} as const;

export type VocabularyUriFactoryInput = {
  base: string;
  entityName: string;
  id: string;
};

export type VocabularyDefinition<TTerms extends Record<string, string>> = {
  base: string;
  terms: TTerms;
  uri(input: VocabularyUriFactoryInput): string | NamedNode;
};

export type Vocabulary<TTerms extends Record<string, string>> = {
  [K in keyof TTerms]: NamedNode;
} & {
  uri(input: Omit<VocabularyUriFactoryInput, "base">): NamedNode;
};

export function defineVocabulary<TTerms extends Record<string, string>>(
  definition: VocabularyDefinition<TTerms>,
): Vocabulary<TTerms> {
  const terms = Object.fromEntries(
    Object.entries(definition.terms).map(([key, value]) => [
      key,
      uri(`${definition.base}${value}`),
    ]),
  ) as Record<keyof TTerms, NamedNode>;

  return {
    ...terms,
    uri(input) {
      const value = definition.uri({
        base: definition.base,
        ...input,
      });

      return typeof value === "string" ? uri(value) : value;
    },
  };
}
