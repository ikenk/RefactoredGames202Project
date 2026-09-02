# JSDoc Design Weight Convention

## 1. Purpose

This document defines searchable importance markers for non-obvious design contracts in the
HW2 WebGL1 implementation.

The markers help future readers answer:

- Which comments describe correctness-critical invariants?
- Which implementation details must be understood before modification?
- Which tests protect the same design decision?
- How can related source and test explanations be found quickly?

Design weight is a reading and maintenance signal. It is not:

- issue priority;
- runtime severity;
- performance weight;
- test execution order;
- a replacement for TODO comments.

## 2. Marker syntax

Place the marker inside a standard JSDoc `@remarks` block:

```ts
/**
 * @remarks
 * [DESIGN-WEIGHT:3][transform-float32-canonicalization]
 *
 * Explanation of the invariant and the production error it prevents.
 */
```

The marker has two components:

```text
[DESIGN-WEIGHT:<weight>][<topic-id>]
```

Rules:

1. `<weight>` must be `1`, `2`, or `3`.
2. `<topic-id>` must use lowercase kebab-case.
3. The marker must remain on one line so `rg` can find it reliably.
4. Source and tests protecting the same decision should reuse the same topic ID.
5. Do not create a marker for comments that merely restate syntax.
6. Do not use a design-weight marker as a substitute for an unfinished-work TODO.

## 3. Weight meanings

### DESIGN-WEIGHT:3 — critical invariant

Use weight 3 when changing the described behavior incorrectly can cause:

- silent data corruption;
- stale caches;
- broken ownership or lifecycle behavior;
- unstable identity;
- numerically inconsistent state;
- failures that may only appear after several frames or operations.

A weight-3 runtime contract must normally have a regression test. If direct testing is
impossible, its registry entry must explain why.

### DESIGN-WEIGHT:2 — important design rationale

Use weight 2 for:

- lifecycle ordering;
- ownership boundaries;
- API encapsulation decisions;
- performance-sensitive caching choices;
- behavior that is easy to misunderstand but not independently critical.

Add a test when the behavior is publicly observable.

### DESIGN-WEIGHT:1 — learning and local trade-off

Use weight 1 for:

- useful mathematical background;
- a local library compatibility note;
- a deliberately selected implementation style;
- an explanation that helps future learning but is not an invariant.

Weight 1 does not require a dedicated regression test.

## 4. Search commands

Find all correctness-critical notes:

```bash
rg -n '\[DESIGN-WEIGHT:3\]' src tests
```

Find weight 2 and weight 3 notes:

```bash
rg -n '\[DESIGN-WEIGHT:[23]\]' src tests
```

Find all source and test explanations for one topic:

```bash
rg -n '\[transform-float32-canonicalization\]' src tests
```

Find every design-weight marker:

```bash
rg -n '\[DESIGN-WEIGHT:[123]\]' src tests
```

## 5. Maintenance rules

When a marked contract changes:

1. Update the production JSDoc.
2. Update the corresponding test JSDoc and assertions.
3. Update the registry entry below.
4. Keep the same topic ID when the underlying contract remains the same.
5. Create a new topic ID when the new contract is conceptually different.
6. Remove obsolete markers rather than leaving contradictory historical notes.

Do not increase a weight merely because a comment is long. Weight describes the importance of
the contract, not the amount of explanation.

## 6. Topic registry

| Topic ID                                  | Weight | Contract                                                                                                                                                                                         | Production location                                                    | Test location                                                                                             |
| ----------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `transform-float32-canonicalization`      |      3 | Public binary64 inputs are quantized with `Math.fround()` before comparison and storage, so repeated decimal assignments do not create false changes.                                            | `src/rendering/scene/Transform.ts`                                     | `tests/unit/rendering/scene/Transform.test.ts`                                                            |
| `transform-dirty-version-separation`      |      3 | `localMatrixDirty` tracks the internal matrix cache, while `version` remains a persistent external observation token. Reading the matrix may clear dirty but must not reset or increase version. | `src/rendering/scene/Transform.ts`                                     | `tests/unit/rendering/scene/Transform.test.ts`                                                            |
| `scene-node-local-world-cache-separation` |      3 | Transform owns local TRS and local-matrix caching; SceneNode combines parent world and local matrices and tracks world-cache validity.                                                           | `src/rendering/scene/SceneNode.ts`                                     | `tests/unit/rendering/scene/SceneNode.test.ts`                                                            |
| `scene-node-stable-debug-type`            |      2 | Debug labels use an explicit stable type string rather than a bundler-renamable runtime constructor name.                                                                                        | `src/rendering/scene/SceneNode.ts`                                     | `tests/unit/rendering/scene/SceneNode.test.ts`                                                            |
| `scene-node-in-place-world-matrix`        |      2 | SceneNode copies local matrix data into its world cache, then relies on gl-matrix alias-safe multiplication to compute `parentWorld * local` in place without a second mat4.                     | `src/rendering/scene/SceneNode.ts`                                     | `tests/unit/rendering/scene/SceneNode.test.ts` verifies non-commuting parent scale and child translation. |
| `version-safe-integer-horizon`            |      1 | Transform and world versions use precise JavaScript integers; at 60 increments per second, reaching `Number.MAX_SAFE_INTEGER` takes about 4.76 million years.                                    | `src/rendering/scene/Transform.ts`, `src/rendering/scene/SceneNode.ts` | No dedicated test; this documents the numeric horizon rather than runtime behavior.                       |
