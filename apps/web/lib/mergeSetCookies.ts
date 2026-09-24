/**
 * The request's cookie header with the cookies a sign-in response just set
 * written over it, so a second sign-in call in the same server action sees
 * the session the first one opened.
 */
export function mergeSetCookies(cookieHeader: string, setCookies: string[]) {
  const jar = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const at = part.indexOf("=");
    if (at > 0) jar.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  for (const line of setCookies) {
    const pair = line.split(";")[0] ?? "";
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    const name = pair.slice(0, at).trim();
    const value = pair.slice(at + 1).trim();
    const expired = /max-age=0\b/i.test(line) || value === "";
    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
