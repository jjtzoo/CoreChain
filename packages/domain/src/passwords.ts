// Starting passwords for accounts the admin creates (decision D13). Testers type
// theirs on a phone, often outdoors, so a starting password is three short
// everyday words and three digits ("copper-ridge-gold-482"): easy to say and
// spell, and still about 100 million combinations, which the server's
// rate limiting makes impractical to guess. The person can change it later.

export const PASSPHRASE_WORDS = [
  "copper", "gold", "silver", "nickel", "iron", "zinc", "lead", "tin", "cobalt",
  "quartz", "granite", "basalt", "shale", "slate", "chalk", "flint", "jade",
  "opal", "agate", "garnet", "mica", "talc", "coal", "sand", "clay", "ridge",
  "valley", "river", "creek", "hill", "rock", "stone", "core", "drill", "camp",
  "trail", "peak", "ledge", "cliff", "mesa", "dune", "reef", "delta", "spring",
  "boulder", "pebble", "lava", "ash", "moss", "fern",
] as const;

/** A whole number from `min` up to, but not including, `max`. */
export type RandomInt = (min: number, max: number) => number;

/**
 * Pass a cryptographic source: `randomInt` from node:crypto on the server. The
 * source is a parameter so this file stays free of Node and browser APIs.
 */
export function suggestPassphrase(randomInt: RandomInt): string {
  const words = Array.from(
    { length: 3 },
    () => PASSPHRASE_WORDS[randomInt(0, PASSPHRASE_WORDS.length)],
  );
  return `${words.join("-")}-${randomInt(100, 1000)}`;
}
