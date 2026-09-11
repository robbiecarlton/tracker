import type { FastifyRequest } from "fastify";
import type { ZodType } from "@tracker/core";

/**
 * `app.ts` registers a raw-string content-type parser for `application/json`
 * (needed for Better Auth's own body handling), which bypasses Fastify's
 * normal automatic JSON body-parsing globally — so every route handler with a
 * body must parse it itself. This does that once, then validates against the
 * given Zod schema, so route handlers don't repeat the parse-and-validate
 * boilerplate.
 */
export function parseBody<T>(
  request: FastifyRequest,
  schema: ZodType<T>,
): { data: T } | { error: { status: number; body: unknown } } {
  let json: unknown;
  try {
    json = request.body ? JSON.parse(request.body as string) : {};
  } catch {
    return { error: { status: 400, body: { error: "invalid_json" } } };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      error: { status: 400, body: { error: "validation_error", issues: parsed.error.issues } },
    };
  }

  return { data: parsed.data };
}
