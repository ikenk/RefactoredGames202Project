export class ExhaustiveMatchError extends Error {
  constructor(value: never, message?: string) {
    super(message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`)
    this.name = 'ExhaustiveMatchError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }
}
