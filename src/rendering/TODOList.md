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
