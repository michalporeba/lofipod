import {
  defineEntity,
  defineVocabulary,
  isNamedNodeTerm,
  objectOf,
  rdf,
  stringValue,
  type EntityDefinition,
  type Triple,
  uri,
} from "../src/index.js";

const schema = {
  name: uri("https://schema.org/name"),
  text: uri("https://schema.org/text"),
} as const;

const dct = {
  created: uri("http://purl.org/dc/terms/created"),
  modified: uri("http://purl.org/dc/terms/modified"),
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

function statusToTerm(status: Task["status"]) {
  return status === "done" ? mlg.Done : mlg.Todo;
}

function termToStatus(value: Triple[2] | undefined): Task["status"] {
  return isNamedNodeTerm(value) && value.value === mlg.Done.value
    ? "done"
    : "todo";
}

function idFromUri(subject: { value: string }): string {
  return subject.value.split("/").at(-1) ?? "";
}

export const TaskEntity: EntityDefinition<Task> = defineEntity<Task>({
  kind: "task",
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
      title: stringValue(graph, subject, schema.name),
      status: termToStatus(objectOf(graph, subject, mlg.status)),
      due:
        typeof objectOf(graph, subject, mlg.due) === "string"
          ? String(objectOf(graph, subject, mlg.due))
          : undefined,
      createdAt: stringValue(graph, subject, dct.created),
      modifiedAt: stringValue(graph, subject, dct.modified),
    };
  },
});

export const JournalEntryEntity: EntityDefinition<JournalEntry> =
  defineEntity<JournalEntry>({
    kind: "journal-entry",
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
        title: stringValue(graph, subject, schema.name),
        text: stringValue(graph, subject, schema.text),
        entryDate: stringValue(graph, subject, mlg.entryDate),
        aboutTaskId: isNamedNodeTerm(aboutTask)
          ? idFromUri(aboutTask)
          : undefined,
        createdAt: stringValue(graph, subject, dct.created),
        modifiedAt: stringValue(graph, subject, dct.modified),
      };
    },
  });

export const demoEntities = [TaskEntity, JournalEntryEntity] as const;
