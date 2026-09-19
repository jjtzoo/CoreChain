/**
 * Parses a required numeric text field. Returns NaN for empty or non-numeric
 * text, which the domain validators reject with a field-level message — so a
 * blank "From depth" is reported as an error instead of silently becoming 0.
 */
export function parseRequiredNumber(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? Number.NaN : Number(trimmed);
}

/**
 * Parses an optional numeric text field: null when left empty, NaN when the
 * text isn't a number (so the validator can flag it).
 */
export function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : Number(trimmed);
}
