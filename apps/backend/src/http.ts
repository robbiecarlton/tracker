import type { IncomingHttpHeaders } from "node:http";

/** Convert Node/Fastify's header bag into a WHATWG `Headers` object. */
export function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const v of value) result.append(key, v);
    } else if (value !== undefined) {
      result.append(key, value);
    }
  }
  return result;
}
