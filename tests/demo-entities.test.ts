import { describe, expect, it } from "vitest";

import { literal, rdf, uri } from "../src/index.js";
import { TaskEntity, demoVocabulary } from "../demo/entities.js";

describe("demo task entity", () => {
  it("uses the bounded task shape as the canonical Pod mapping contract", () => {
    const task = {
      id: "task-1",
      title: "Write docs",
      status: "todo" as const,
      due: "2026-04",
    };
    const subject = demoVocabulary.uri({
      entityName: "task",
      id: task.id,
    });
    const triples = TaskEntity.toRdf(task, {
      uri(currentTask) {
        return demoVocabulary.uri({
          entityName: "task",
          id: currentTask.id,
        });
      },
      child(path: string) {
        return uri(`unused:${path}`);
      },
    });

    expect(TaskEntity.pod).toEqual({
      basePath: "tasks/",
    });
    expect(TaskEntity.rdfType).toEqual(demoVocabulary.Task);
    expect(triples).toEqual([
      [subject, rdf.type, demoVocabulary.Task],
      [subject, uri("https://schema.org/name"), "Write docs"],
      [subject, demoVocabulary.status, demoVocabulary.Todo],
      [subject, demoVocabulary.due, literal("2026-04", demoVocabulary.edtf)],
    ]);
  });

  it("rejects unsupported status terms during projection", () => {
    const subject = demoVocabulary.uri({
      entityName: "task",
      id: "task-1",
    });

    expect(() =>
      TaskEntity.project(
        [
          [subject, uri("https://schema.org/name"), "Write docs"],
          [
            subject,
            demoVocabulary.status,
            demoVocabulary.uri({
              entityName: "status",
              id: "blocked",
            }),
          ],
          [
            subject,
            demoVocabulary.due,
            literal("2026-04", demoVocabulary.edtf),
          ],
        ],
        {
          uri() {
            return subject;
          },
          child(path: string) {
            return uri(`unused:${path}`);
          },
        },
      ),
    ).toThrow("Unsupported task status term");
  });

  it("round-trips the bounded task fields without adding sync-only metadata", () => {
    const subject = demoVocabulary.uri({
      entityName: "task",
      id: "task-1",
    });

    const task = TaskEntity.project(
      [
        [subject, uri("https://schema.org/name"), "Write docs"],
        [subject, demoVocabulary.status, demoVocabulary.Done],
        [subject, demoVocabulary.due, literal("2026-04", demoVocabulary.edtf)],
      ],
      {
        uri() {
          return subject;
        },
        child(path: string) {
          return uri(`unused:${path}`);
        },
      },
    );

    expect(task).toEqual({
      id: "task-1",
      title: "Write docs",
      status: "done",
      due: "2026-04",
    });
  });
});
