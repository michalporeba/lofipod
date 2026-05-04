# LifeGraph Demo Ontology

This directory contains the first draft of the `mlg` ontology subset used by
the minimal in-repo demo application.

The public namespace is:

- `mlg:` = `https://michalporeba.com/ns/lifegraph#`

This first subset is intentionally narrow. It only covers:

- tasks
- journal entries

It is meant to seed a broader ontology for future personal applications, while
staying small enough to use in the first CLI/TUI demo and test harness.

## Main terms

- `mlg:Task`
- `mlg:JournalEntry`
- `mlg:status`
- `mlg:entryDate`
- `mlg:due`
- `mlg:priority`
- `mlg:aboutTask`
- `mlg:relatedTo`
- `mlg:edtf`
- `mlg:Todo`
- `mlg:Done`
- `mlg:PriorityLow`
- `mlg:PriorityNormal`
- `mlg:PriorityHigh`

## Reused vocabularies

The ontology draft reuses:

- `schema:name`
- `schema:text`
- `dct:created`
- `dct:modified`
- `life:Task`

## EDTF

`mlg:edtf` is a custom datatype whose lexical value is a string interpreted as
an EDTF-like date expression.

The intended first supported examples are:

- `"2022"^^mlg:edtf`
- `"2026-04"^^mlg:edtf`
- `"2026-04-12"^^mlg:edtf`
- `"2026-21"^^mlg:edtf`
- `"2026-04~"^^mlg:edtf`

This keeps the ontology aligned with the intended app behaviour:

- journal entries may use imprecise dates such as a year summary
- task deadlines may use month precision or approximate values

## Example

```turtle
@prefix mlg: <https://michalporeba.com/ns/lifegraph#> .
@prefix schema: <https://schema.org/> .
@prefix dct: <http://purl.org/dc/terms/> .

<#task-1>
  a mlg:Task ;
  schema:name "Prepare April review" ;
  mlg:status mlg:Todo ;
  mlg:priority mlg:PriorityNormal ;
  mlg:due "2026-04"^^mlg:edtf .

<#entry-1>
  a mlg:JournalEntry ;
  schema:name "Summary 2022" ;
  schema:text "A retrospective over the year." ;
  mlg:entryDate "2022"^^mlg:edtf ;
  dct:created "2026-03-29T09:05:00Z" .
```

The task example above matches the current canonical task resource the demo
projects to the Pod. Task resources stay intentionally shallow and do not carry
journal-only metadata such as `dct:created` or `dct:modified`.

Legacy task resources that predate `mlg:priority` are still interpreted through
the bounded compatibility path. Reconciliation merges compatible canonical and
local graphs, then reprojects through the same entity contract so canonical
data remains reusable.

For Story 2's sync inspection path, the important point is that this Turtle is
the current Solid-specific canonical output of the demo's task mapping, not a
special core-only debug format. Inspecting `tasks/<id>.ttl` lets a developer
see user-controlled Pod data directly while the `lofipod` core stays
storage-agnostic and adapter-driven.

See [lifegraph-demo.ttl](lifegraph-demo.ttl) for the ontology draft itself.
