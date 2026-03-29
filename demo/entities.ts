import {
  defineEntity,
  defineVocabulary,
  rdf,
  type EntityDefinition,
  type Triple,
} from "../src/index.js";

const schema = {
  name: "https://schema.org/name",
  text: "https://schema.org/text",
} as const;

const dct = {
  created: "http://purl.org/dc/terms/created",
  modified: "http://purl.org/dc/terms/modified",
} as const;

export type Task = {
  id: string;
  title: string;
  status: "todo" | "done";
  due?: string;
  createdAt: string;
  modifiedAt: string;
};

export type JournalEntry = {
  id: string;
  title: string;
  text: string;
  entryDate: string;
  aboutTaskId?: string;
  createdAt: string;
  modifiedAt: string;
};

export const mlg = defineVocabulary({
  base: "https://michalporeba.com/",
  terms: {
    Task: "ns/lifegraph#Task",
    JournalEntry: "ns/lifegraph#JournalEntry",
    status: "ns/lifegraph#status",
    entryDate: "ns/lifegraph#entryDate",
    due: "ns/lifegraph#due",
    aboutTask: "ns/lifegraph#aboutTask",
    relatedTo: "ns/lifegraph#relatedTo",
    edtf: "ns/lifegraph#edtf",
    Todo: "ns/lifegraph#Todo",
    Done: "ns/lifegraph#Done",
  },
  uri({ base, entityName, id }) {
    return `${base}demo/id/${entityName}/${id}`;
  },
});

function objectOf(
  graph: Triple[],
  target: string,
  predicate: string,
): Triple[2] | undefined {
  return graph.find(
    ([subjectTerm, predicateTerm]) =>
      subjectTerm === target && predicateTerm === predicate,
  )?.[2];
}

function statusToTerm(status: Task["status"]): string {
  return status === "done" ? mlg.Done : mlg.Todo;
}

function termToStatus(value: Triple[2] | undefined): Task["status"] {
  return value === mlg.Done ? "done" : "todo";
}

function idFromUri(subject: string): string {
  return subject.split("/").at(-1) ?? "";
}

export const TaskEntity: EntityDefinition<Task> = defineEntity<Task>({
  name: "task",
  pod: {
    basePath: "tasks/",
  },
  rdfType: mlg.Task,
  id: (task) => task.id,
  uri: (task) =>
    mlg.uri({
      entityName: "task",
      id: task.id,
    }),
  toRdf(task, { uri }) {
    const subject = uri(task);

    return [
      [subject, rdf.type, mlg.Task],
      [subject, schema.name, task.title],
      [subject, mlg.status, statusToTerm(task.status)],
      ...(task.due ? ([[subject, mlg.due, task.due]] satisfies Triple[]) : []),
      [subject, dct.created, task.createdAt],
      [subject, dct.modified, task.modifiedAt],
    ];
  },
  project(graph, { uri }) {
    const subject = uri();

    return {
      id: idFromUri(subject),
      title: String(objectOf(graph, subject, schema.name) ?? ""),
      status: termToStatus(objectOf(graph, subject, mlg.status)),
      due:
        typeof objectOf(graph, subject, mlg.due) === "string"
          ? String(objectOf(graph, subject, mlg.due))
          : undefined,
      createdAt: String(objectOf(graph, subject, dct.created) ?? ""),
      modifiedAt: String(objectOf(graph, subject, dct.modified) ?? ""),
    };
  },
});

export const JournalEntryEntity: EntityDefinition<JournalEntry> =
  defineEntity<JournalEntry>({
    name: "journal-entry",
    pod: {
      basePath: "journal-entries/",
    },
    rdfType: mlg.JournalEntry,
    id: (entry) => entry.id,
    uri: (entry) =>
      mlg.uri({
        entityName: "journal-entry",
        id: entry.id,
      }),
    toRdf(entry, { uri }) {
      const subject = uri(entry);

      return [
        [subject, rdf.type, mlg.JournalEntry],
        [subject, schema.name, entry.title],
        [subject, schema.text, entry.text],
        [subject, mlg.entryDate, entry.entryDate],
        ...(entry.aboutTaskId
          ? ([
              [
                subject,
                mlg.aboutTask,
                mlg.uri({
                  entityName: "task",
                  id: entry.aboutTaskId,
                }),
              ],
            ] satisfies Triple[])
          : []),
        [subject, dct.created, entry.createdAt],
        [subject, dct.modified, entry.modifiedAt],
      ];
    },
    project(graph, { uri }) {
      const subject = uri();
      const aboutTask = objectOf(graph, subject, mlg.aboutTask);

      return {
        id: idFromUri(subject),
        title: String(objectOf(graph, subject, schema.name) ?? ""),
        text: String(objectOf(graph, subject, schema.text) ?? ""),
        entryDate: String(objectOf(graph, subject, mlg.entryDate) ?? ""),
        aboutTaskId:
          typeof aboutTask === "string" ? idFromUri(aboutTask) : undefined,
        createdAt: String(objectOf(graph, subject, dct.created) ?? ""),
        modifiedAt: String(objectOf(graph, subject, dct.modified) ?? ""),
      };
    },
  });

export const demoEntities = [TaskEntity, JournalEntryEntity] as const;
