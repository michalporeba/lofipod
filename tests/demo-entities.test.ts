import { describe, expect, it } from "vitest";

import { literal, uri } from "../src/index.js";
import { TaskEntity, demoVocabulary } from "../demo/entities.js";

describe("demo task entity", () => {
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
});
