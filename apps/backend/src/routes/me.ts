import type { FastifyInstance } from "fastify";
import { auth } from "../auth";
import { toWebHeaders } from "../http";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/me", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: toWebHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({ error: "unauthenticated" });
    }

    return { user: session.user };
  });
}
