import { defineEntity, defineVocabulary, rdf } from "../../src/index.js";
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
      const title = graph.find(
        ([subjectTerm, predicateTerm]) =>
          subjectTerm === subject && predicateTerm === ex.title,
      )?.[2];
      const tags = graph
        .filter(
          ([subjectTerm, predicateTerm]) =>
            subjectTerm === subject && predicateTerm === ex.tag,
        )
        .map(([, , object]) => String(object))
        .sort();

      return {
        id: subject.split("/").at(-1) ?? "",
        title: String(title ?? ""),
        tags,
      };
    },
  });

  return { entity };
}
