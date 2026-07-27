/**
 * Nominal-typing helper so identifiers like UserId and DeviceId can't be
 * accidentally interchanged even though both are strings at runtime.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };
