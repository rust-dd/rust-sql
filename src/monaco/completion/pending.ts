/**
 * Which schema a completion request needs loaded before it can answer well.
 *
 * Kept apart from the provider so the rule is testable: the first request
 * against a schema waits for its snapshot, and every later one reads memory.
 */

import type { CaretExpectation, RelationRef } from "./types";

/**
 * The schema whose catalog this request depends on, or `undefined` when the
 * answer does not need one.
 *
 * A qualifier that names a schema needs that schema. Anything else — a bare
 * table position, a column position, an alias qualifier — is answered from the
 * default schema, since that is where relations are looked up first.
 */
export function neededSchema(
  expectation: CaretExpectation,
  scope: RelationRef[],
  knownSchemas: string[],
  defaultSchema: string,
): string | undefined {
  const kinds = new Set(expectation.kinds);
  const qualifier = expectation.qualifier[expectation.qualifier.length - 1];

  if (qualifier) {
    const known = knownSchemas.find((s) => s.toLowerCase() === qualifier.toLowerCase());
    if (known) return known;

    // An alias qualifier resolves through a relation, which may name its schema.
    const ref = scope.find(
      (r) =>
        r.alias?.toLowerCase() === qualifier.toLowerCase() ||
        r.name.toLowerCase() === qualifier.toLowerCase(),
    );
    return ref?.schema ?? defaultSchema;
  }

  if (kinds.has("table") || kinds.has("view") || kinds.has("column") || kinds.has("function")) {
    return defaultSchema;
  }

  // Keyword-only positions need nothing loaded.
  return undefined;
}

/** Resolve, but give up after `ms` so a slow catalog cannot wedge the editor. */
export function withTimeout(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}
