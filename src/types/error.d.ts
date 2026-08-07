interface ErrorConstructor {
  captureStackTrace?: (
    targetObject: object,
    constructorOpt?: abstract new (...args: never[]) => unknown
  ) => void
}
