# Rendering TODO List

This document records rendering decisions that are intentionally unresolved. An item in this file is not authorization to implement it; each item still requires an explicit contract, tests, and source-path approval before production code changes.

## Resource dispose-listener failure semantics

**Status:** Unresolved. The current `Resource.dispose()` implementation and tests do not define behavior for a dispose listener that throws.

### Current behavior

`Resource.dispose()` currently:

1. marks the resource as disposed;
2. invokes listeners in registration order;
3. clears the listener set;
4. calls `disposeCPUData()`.

Because the current loop does not catch listener errors, a throwing listener interrupts disposal immediately. Later listeners are not invoked, the listener set is not cleared, and `disposeCPUData()` is not called.

### Decisions required before implementation

- Decide whether disposal must continue notifying later listeners after one listener throws.
- Decide whether listener cleanup and `disposeCPUData()` must run even when a listener throws.
- Decide whether disposal reports the first error, the last error, or an `AggregateError` containing every listener and CPU-disposal failure.
- Decide how repeated `dispose()` calls behave after a partially failed disposal attempt.
- Decide whether backend and resource-manager listeners are contractually forbidden from throwing, or whether `Resource` must defend against arbitrary listener failures.

### Required verification

Before changing `Resource.dispose()`, add focused tests for the chosen ordering, cleanup guarantee, repeated-dispose behavior, and error-reporting policy. Do not silently swallow listener or CPU-disposal failures.

### Related files

- `src/rendering/core/Resource.ts`
- `tests/unit/rendering/core/Resource.test.ts`

## Geometry topology expansion

**Status:** Deferred. The current static Geometry contract supports `triangles`, `lines`, `line-strip`, and `triangle-strip` only.

### Trigger

Revisit this item only when a later homework or runtime feature actually requires another primitive topology. Starting FFT Ocean by itself is not a trigger: a fullscreen FFT Ocean pass can continue using triangles unless its concrete rendering design requires something else.

### Required implementation scope

Adding `points`, `line-loop`, `triangle-fan`, or another topology requires all of the following changes in the same tested batch:

1. extend `PrimitiveTopology`;
2. define and test its valid `drawCount` rules;
3. map it to the corresponding WebGL1 primitive enum in the backend;
4. add CPU Geometry tests and backend draw tests;
5. update or remove `TODO(geometry-topology-expansion)` only after the complete path exists.

Do not extend only the TypeScript union. Doing so would let CPU Geometry accept a topology that the backend may not be able to draw correctly.

### Search marker

```text
TODO(geometry-topology-expansion)
```

### Related files

- `src/rendering/resources/Geometry.ts`
- `tests/unit/rendering/resources/Geometry.test.ts`
- future WebGL1 topology mapping and backend draw tests
