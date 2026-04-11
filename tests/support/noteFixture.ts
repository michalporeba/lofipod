import {
  defineEntity,
  defineVocabulary,
  rdf,
  stringValue,
} from "../../src/index.js";
import type { EntityDefinition, Triple } from "../../src/index.js";

export type Note = {
  id: string;
  title: string;
  body: string;
};

export function createNoteFixture(): { entity: EntityDefinition<Note> } {
  const ex = defineVocabulary({
    base: "https://example.com/",
    terms: {
      Note: "ns#Note",
      title: "ns#title",
      body: "ns#body",
    },
    uri({ base, entityName, id }) {
      return `${base}id/${entityName}/${id}`;
    },
  });

  const entity = defineEntity<Note>({
    kind: "note",
    pod: {
      basePath: "notes/",
    },
    rdfType: ex.Note,
    id: (note) => note.id,
    uri: (note) =>
      ex.uri({
        entityName: "note",
        id: note.id,
      }),
    toRdf(note, { uri }) {
      const subject = uri(note);

      return [
        [subject, rdf.type, ex.Note],
        [subject, ex.title, note.title],
        [subject, ex.body, note.body],
      ] satisfies Triple[];
    },
    project(graph, { uri }) {
      const subject = uri();

      return {
        id: subject.value.split("/").at(-1) ?? "",
        title: stringValue(graph, subject, ex.title),
        body: stringValue(graph, subject, ex.body),
      };
    },
  });

  return { entity };
}
