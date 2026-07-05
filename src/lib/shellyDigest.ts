import { createHash, randomBytes } from "crypto";

function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

function parseWwwAuthenticate(header: string) {
  const result: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(header))) {
    result[match[1]] = match[2] ?? match[3];
  }
  return result;
}

export interface ShellyAuth {
  username: string;
  password: string;
}

/**
 * Fetches a Shelly local RPC/HTTP endpoint. Retries with RFC 2617 Digest
 * auth if the device responds 401 and credentials were supplied — Gen2/3
 * Shelly devices use Digest, not Basic, when "Restrict login" is enabled.
 */
export async function shellyFetch(
  url: string,
  auth?: ShellyAuth,
  init: RequestInit = {}
): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 401 || !auth?.username) {
    return first;
  }

  const header = first.headers.get("www-authenticate");
  if (!header || !/^digest/i.test(header)) {
    return first;
  }

  const params = parseWwwAuthenticate(header);
  const { realm, nonce, qop, opaque, algorithm } = params;
  const method = init.method ?? "GET";
  const parsedUrl = new URL(url);
  const uri = parsedUrl.pathname + (parsedUrl.search || "");

  const nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");

  const ha1Base = md5(`${auth.username}:${realm}:${auth.password}`);
  const ha1 = algorithm && /sess/i.test(algorithm) ? md5(`${ha1Base}:${nonce}:${cnonce}`) : ha1Base;
  const ha2 = md5(`${method}:${uri}`);

  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const authParts = [
    `username="${auth.username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (qop) authParts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  if (opaque) authParts.push(`opaque="${opaque}"`);
  if (algorithm) authParts.push(`algorithm=${algorithm}`);

  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Digest ${authParts.join(", ")}` },
  });
}
