import net from "net";

/**
 * The rate-limit key for a request's address (req.ip). IPv6 users usually have
 * a whole block of addresses, so they're grouped by its first 56 bits;
 * otherwise one device could hop between addresses to get round a limit.
 */
export function clientKey(req) {
  const ip = req.ip ?? "";
  if (!net.isIPv6(ip)) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const [head, tail = ""] = ip.split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  const word = (i) => parseInt(groups[i] ?? "0", 16) || 0;
  return `${word(0).toString(16)}:${word(1).toString(16)}:${word(2).toString(16)}:${(word(3) & 0xff00).toString(16)}::/56`;
}
