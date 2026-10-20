import net from "net";
import { CustomeErrorHandler } from "../services/index.js";

/**
 * Rejects URLs that point at internal destinations (I-3).
 *
 * Today no URL accepted from a client is ever fetched (shipment tracking URLs are only stored), so
 * this is a syntactic guard. Anything that does start fetching user-supplied URLs must also resolve
 * the hostname, check every resolved address with isPrivateAddress, connect to that address (to
 * defeat DNS rebinding) and refuse redirects or re-check each hop. Prefer a destination allowlist.
 */
const BLOCKED_HOSTNAMES = [/^localhost$/i, /\.localhost$/i, /\.internal$/i, /\.local$/i, /^metadata\.google\.internal$/i];

const ipv4ToInt = (ip: string) => ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
const inRange = (ip: number, base: string, bits: number) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ip & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
};
const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const isPrivateV4 = (ip: string) => PRIVATE_V4.some(([base, bits]) => inRange(ipv4ToInt(ip), base, bits));

/** Expands an IPv6 address to its eight 16-bit groups. */
const ipv6Groups = (ip: string): number[] => {
  let address = ip.toLowerCase();
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (v4) {
    const n = ipv4ToInt(v4[1]!);
    address = address.replace(v4[1]!, `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`);
  }
  const [head = "", tail] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  // Malformed input yields fewer or more than 8 groups, which the caller treats as unsafe.
  const missing = tail === undefined ? 0 : Math.max(0, 8 - left.length - right.length);
  return [...left, ...Array<string>(missing).fill("0"), ...right].map((group) => parseInt(group || "0", 16));
};

const isPrivateV6 = (ip: string) => {
  const g = ipv6Groups(ip);
  if (g.length !== 8) return true;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible addresses: check the embedded IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return isPrivateV4(`${g[6]! >> 8}.${g[6]! & 0xff}.${g[7]! >> 8}.${g[7]! & 0xff}`);
  }
  return false;
};

export const isPrivateAddress = (address: string): boolean => {
  const version = net.isIP(address);
  if (version === 4) return isPrivateV4(address);
  if (version === 6) return isPrivateV6(address);
  return false;
};

export const assertSafeExternalUrl = (value: string | undefined | null): void => {
  if (!value) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw CustomeErrorHandler.badRequest("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw CustomeErrorHandler.badRequest("Only HTTPS URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw CustomeErrorHandler.badRequest("URLs with credentials are not allowed");
  }

  // WHATWG URL parsing already normalises decimal, hex and octal IPv4 hosts to dotted form.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isPrivateAddress(hostname) || BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname))) {
    throw CustomeErrorHandler.badRequest("Private network URLs are not allowed");
  }
};
