const canonicalGameOrigin = "https://ff.adeticket.com";

export function gameOrigin(hostname: string = location.hostname, origin: string = location.origin) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
    ? origin
    : canonicalGameOrigin;
}
