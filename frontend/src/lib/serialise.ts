/** JSON-safe projection of a Docket. BigInt is not structured-cloneable across the RSC boundary. */
export function serialise<T extends Record<string, unknown>>(d: T) {
  return JSON.parse(
    JSON.stringify(d, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as Record<string, unknown>;
}
