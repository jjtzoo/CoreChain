// E10-8: the oldest CoreChain Field version this server still accepts syncing
// from. Raise it only when a database change breaks older phones; until then,
// a phone that missed weeks of patches keeps syncing exactly as before. Set
// as the MIN_APP_VERSION environment variable so the owner can raise it
// without a code change; defaults to the first shipped version, which
// accepts every phone in the field.
export const MIN_APP_VERSION = process.env.MIN_APP_VERSION?.trim() || "0.1.0";
