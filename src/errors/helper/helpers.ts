import { ExhaustiveMatchError } from '@/errors/LanguageError/ExhaustiveMatchError'

export function assertNever(value: never, message?: string): never {
  throw new ExhaustiveMatchError(value, message)
}
