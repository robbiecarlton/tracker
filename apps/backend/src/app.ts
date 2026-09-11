import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { auth } from "./auth";
import { env } from "./env";
import { toWebHeaders } from "./http";
import { habitsRoutes } from "./routes/habits";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  // Better Auth needs the raw request body, not a parsed object.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) =>
    done(null, body),
  );

  app.register(cors, {
    origin: [env.WEB_ORIGIN],
    credentials: true,
  });

  // Mount Better Auth on /api/auth/*
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, env.BETTER_AUTH_URL);
      const hasBody = request.method !== "GET" && request.method !== "HEAD";
      const webRequest = new Request(url, {
        method: request.method,
        headers: toWebHeaders(request.headers),
        body: hasBody ? (request.body as string | undefined) || undefined : undefined,
      });

      const response = await auth.handler(webRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    },
  });

  app.register(healthRoutes);
  app.register(meRoutes);
  app.register(habitsRoutes);

  return app;
}
