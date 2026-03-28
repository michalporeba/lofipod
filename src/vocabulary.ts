export const rdf = {
  type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
} as const;

export type VocabularyUriFactoryInput = {
  base: string;
  entityName: string;
  id: string;
};

export type VocabularyDefinition<TTerms extends Record<string, string>> = {
  base: string;
  terms: TTerms;
  uri(input: VocabularyUriFactoryInput): string;
};

export type Vocabulary<TTerms extends Record<string, string>> = {
  [K in keyof TTerms]: string;
} & {
  uri(input: Omit<VocabularyUriFactoryInput, "base">): string;
};

export function defineVocabulary<TTerms extends Record<string, string>>(
  definition: VocabularyDefinition<TTerms>,
): Vocabulary<TTerms> {
  const terms = Object.fromEntries(
    Object.entries(definition.terms).map(([key, value]) => [
      key,
      `${definition.base}${value}`,
    ]),
  ) as Record<keyof TTerms, string>;

  return {
    ...terms,
    uri(input) {
      return definition.uri({
        base: definition.base,
        ...input,
      });
    },
  };
}
