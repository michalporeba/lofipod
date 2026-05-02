import {
  defineEntity,
  defineVocabulary,
  isNamedNodeTerm,
  literal,
  objectOf,
  rdf,
  stringValue,
  type EntityDefinition,
  type Term,
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

export const demoVocabulary = defineVocabulary({
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
  return status === "done" ? demoVocabulary.Done : demoVocabulary.Todo;
}

function termToStatus(value: Triple[2] | undefined): Task["status"] {
  if (!isNamedNodeTerm(value)) {
    throw new Error("Task status must be an RDF named node.");
  }

  if (value.value === demoVocabulary.Todo.value) {
    return "todo";
  }

  if (value.value === demoVocabulary.Done.value) {
    return "done";
  }

  throw new Error(`Unsupported task status term: ${value.value}`);
}

function optionalStringValue(value: Term | undefined): string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return value.value;
}

// The demo URI layout keeps the entity ID in the final path segment.
function idFromDemoUri(subject: { value: string }): string {
  return subject.value.split("/").at(-1) ?? "";
}

// The demo's first entity stays on the bounded local task shape. This single
// definition is both the local-first entity contract and the canonical Pod
// mapping contract that sync projects into `tasks/<id>.ttl`.
export const TaskEntity: EntityDefinition<Task> = defineEntity<Task>({
  kind: "task",
  pod: {
    basePath: "tasks/",
  },
  rdfType: demoVocabulary.Task,
  id: (task) => task.id,
  // The URI, RDF type, predicates, and Pod base path below are the demo's
  // sync-scoped canonical mapping choices layered onto the same local model.
  uri: (task) =>
    demoVocabulary.uri({
      entityName: "task",
      id: task.id,
    }),
  toRdf(task, { uri }) {
    const subject = uri(task);

    return [
      [subject, rdf.type, demoVocabulary.Task],
      [subject, schema.name, task.title],
      [subject, demoVocabulary.status, statusToTerm(task.status)],
      ...(task.due
        ? ([
            [
              subject,
              demoVocabulary.due,
              literal(task.due, demoVocabulary.edtf),
            ],
          ] satisfies Triple[])
        : []),
    ];
  },
  project(graph, { uri }) {
    const subject = uri();

    return {
      id: idFromDemoUri(subject),
      title: stringValue(graph, subject, schema.name),
      status: termToStatus(objectOf(graph, subject, demoVocabulary.status)),
      due: optionalStringValue(objectOf(graph, subject, demoVocabulary.due)),
    };
  },
});

export const JournalEntryEntity: EntityDefinition<JournalEntry> =
  defineEntity<JournalEntry>({
    kind: "journal-entry",
    pod: {
      basePath: "journal-entries/",
    },
    rdfType: demoVocabulary.JournalEntry,
    id: (entry) => entry.id,
    uri: (entry) =>
      demoVocabulary.uri({
        entityName: "journal-entry",
        id: entry.id,
      }),
    toRdf(entry, { uri }) {
      const subject = uri(entry);

      return [
        [subject, rdf.type, demoVocabulary.JournalEntry],
        [subject, schema.name, entry.title],
        [subject, schema.text, entry.text],
        [
          subject,
          demoVocabulary.entryDate,
          literal(entry.entryDate, demoVocabulary.edtf),
        ],
        ...(entry.aboutTaskId
          ? ([
              [
                subject,
                demoVocabulary.aboutTask,
                demoVocabulary.uri({
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
      const aboutTask = objectOf(graph, subject, demoVocabulary.aboutTask);

      return {
        id: idFromDemoUri(subject),
        title: stringValue(graph, subject, schema.name),
        text: stringValue(graph, subject, schema.text),
        entryDate: stringValue(graph, subject, demoVocabulary.entryDate),
        aboutTaskId: isNamedNodeTerm(aboutTask)
          ? idFromDemoUri(aboutTask)
          : undefined,
        createdAt: stringValue(graph, subject, dct.created),
        modifiedAt: stringValue(graph, subject, dct.modified),
      };
    },
  });

export const demoEntities = [TaskEntity, JournalEntryEntity] as const;
