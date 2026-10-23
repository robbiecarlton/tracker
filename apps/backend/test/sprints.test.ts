import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { rawClient } from "../src/db";
import { runMigrations } from "../src/db/migrator";
import { signUpAndGetCookie } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  await runMigrations();
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await rawClient.close().catch(() => {});
});

interface SprintJson {
  id: string;
  name: string | null;
  startAt: string;
  endAt: string;
  target: number;
}

const body = {
  name: "March",
  startAt: "2026-03-01T00:00:00.000Z",
  endAt: "2026-03-08T00:00:00.000Z",
  target: 50,
};

function send(cookie: string, method: "POST" | "PATCH" | "DELETE", url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: { cookie, ...(payload ? { "content-type": "application/json" } : {}) },
    ...(payload ? { payload: JSON.stringify(payload) } : {}),
  });
}

async function list(cookie: string): Promise<SprintJson[]> {
  const res = await app.inject({ method: "GET", url: "/api/sprints", headers: { cookie } });
  return (res.json() as { sprints: SprintJson[] }).sprints;
}

describe("sprints API", () => {
  it("requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sprints" });
    expect(res.statusCode).toBe(401);
  });

  it("creates, lists (by start), edits, and deletes", async () => {
    const cookie = await signUpAndGetCookie(app, "sprint-crud");
    const later = await send(cookie, "POST", "/api/sprints", {
      ...body,
      startAt: "2026-04-01T00:00:00.000Z",
      endAt: "2026-04-08T00:00:00.000Z",
    });
    const created = await send(cookie, "POST", "/api/sprints", body);
    expect(created.statusCode).toBe(201);
    const sprint = (created.json() as { sprint: SprintJson }).sprint;
    expect(sprint).toMatchObject(body);

    expect((await list(cookie)).map((s) => s.id)).toEqual([
      sprint.id,
      (later.json() as { sprint: SprintJson }).sprint.id,
    ]);

    const edited = await send(cookie, "PATCH", `/api/sprints/${sprint.id}`, {
      ...body,
      name: "",
      target: 80,
    });
    expect(edited.statusCode).toBe(200);
    expect((edited.json() as { sprint: SprintJson }).sprint).toMatchObject({
      name: null,
      target: 80,
    });

    expect((await send(cookie, "DELETE", `/api/sprints/${sprint.id}`)).statusCode).toBe(204);
    expect(await list(cookie)).toHaveLength(1);
  });

  it("validates the body", async () => {
    const cookie = await signUpAndGetCookie(app, "sprint-invalid");
    const res = await send(cookie, "POST", "/api/sprints", { ...body, endAt: body.startAt });
    expect(res.statusCode).toBe(400);
  });

  it("scopes sprints to their owner", async () => {
    const owner = await signUpAndGetCookie(app, "sprint-owner");
    const other = await signUpAndGetCookie(app, "sprint-other");
    const sprint = (
      (await send(owner, "POST", "/api/sprints", body)).json() as { sprint: SprintJson }
    ).sprint;

    expect(await list(other)).toHaveLength(0);
    expect((await send(other, "PATCH", `/api/sprints/${sprint.id}`, body)).statusCode).toBe(404);
    expect((await send(other, "DELETE", `/api/sprints/${sprint.id}`)).statusCode).toBe(404);
    expect(await list(owner)).toHaveLength(1);
  });
});
