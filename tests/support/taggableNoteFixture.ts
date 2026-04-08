import {
  defineEntity,
  defineVocabulary,
  isNamedNodeTerm,
  rdf,
  stringValue,
} from "../../src/index.js";
import type { EntityDefinition, Triple } from "../../src/index.js";

export type TaggableNote = {
  id: string;
  title: string;
  tags: string[];
};

export function createTaggableNoteFixture(): {
  entity: EntityDefinition<TaggableNote>;
} {
  const ex = defineVocabulary({
    base: "https://example.com/",
    terms: {
      Note: "ns#Note",
      title: "ns#title",
      tag: "ns#tag",
    },
    uri({ base, entityName, id }) {
      return `${base}id/${entityName}/${id}`;
    },
  });

  const entity = defineEntity<TaggableNote>({
    name: "taggable-note",
    pod: {
      basePath: "taggable-notes/",
    },
    rdfType: ex.Note,
    id: (note) => note.id,
    uri: (note) =>
      ex.uri({
        entityName: "taggable-note",
        id: note.id,
      }),
    toRdf(note, { uri }) {
      const subject = uri(note);
      const tags = [...note.tags].sort();

      return [
        [subject, rdf.type, ex.Note],
        [subject, ex.title, note.title],
        ...tags.map((tag) => [subject, ex.tag, tag] satisfies Triple),
      ];
    },
    project(graph, { uri }) {
      const subject = uri();
      const tags = graph
        .filter(
          ([subjectTerm, predicateTerm]) =>
            isNamedNodeTerm(subjectTerm) &&
            isNamedNodeTerm(predicateTerm) &&
            subjectTerm.value === subject.value &&
            predicateTerm.value === ex.tag.value,
        )
        .map(([, , object]) =>
          typeof object === "string" ||
          typeof object === "number" ||
          typeof object === "boolean"
            ? String(object)
            : String(object.value),
        )
        .sort();

      return {
        id: subject.value.split("/").at(-1) ?? "",
        title: stringValue(graph, subject, ex.title),
        tags,
      };
    },
  });

  return { entity };
}
