import { env } from "cloudflare:workers";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { GitHubHandler } from "./github-handler";

type Props = { login: string; name: string; email: string; accessToken: string };
const ALLOWED_USERNAMES = new Set(["grispy25"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const activityId = z.string().regex(/^[A-Za-z0-9_-]+$/, "Invalid activity ID");

async function readIntervals(path: string, query?: URLSearchParams): Promise<unknown> {
  const key = (env as unknown as { INTERVALS_API_KEY?: string }).INTERVALS_API_KEY;
  if (!key) throw new Error("INTERVALS_API_KEY is not configured");
  const endpoint = new URL(`https://intervals.icu/api/v1${path}`);
  if (query) endpoint.search = query.toString();
  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: `Basic ${btoa(`API_KEY:${key}`)}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Intervals.icu API HTTP ${response.status}`);
  return response.json();
}

function wrap(run: () => Promise<unknown>) {
  return async () => {
    try {
      return { content: [{ type: "text" as const, text: JSON.stringify(await run()) }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: error instanceof Error ? error.message : "API error" }],
      };
    }
  };
}

function createServer() {
  const props = getMcpAuthContext()?.props as Props | undefined;
  if (!props?.login || !ALLOWED_USERNAMES.has(props.login.toLowerCase())) {
    throw new Error("Unauthorized GitHub user");
  }
  const server = new McpServer({ name: "Intervals.icu Direct MCP", version: "1.0.0" });

  server.registerTool("connection_status", {
    description: "Check Intervals.icu connectivity using a read-only wellness request, without exposing credentials",
  }, wrap(async () => {
    await readIntervals("/athlete/0/wellness", new URLSearchParams({ oldest: "2026-10-30", newest: "2026-10-30" }));
    return { connected: true, source: "Intervals.icu API", auth: "GitHub OAuth" };
  }));

  server.registerTool("get_activities", {
    description: "Fetch original Intervals.icu activity summaries for a date range",
    inputSchema: { oldest: isoDate, newest: isoDate },
  }, async ({ oldest, newest }) => wrap(() => {
    if (oldest > newest) throw new Error("oldest must not be after newest");
    return readIntervals("/athlete/0/activities", new URLSearchParams({ oldest, newest }));
  })());

  server.registerTool("get_activity_raw", {
    description: "Fetch the original, unmodified Intervals.icu activity JSON including intervals. Inspect SFT-related fields without inventing interpretations.",
    inputSchema: { id: activityId },
  }, async ({ id }) => wrap(() => readIntervals(`/activity/${encodeURIComponent(id)}`, new URLSearchParams({ intervals: "true" })))());

  server.registerTool("get_activity_intervals", {
    description: "Fetch the original Intervals.icu intervals for one activity",
    inputSchema: { id: activityId },
  }, async ({ id }) => wrap(() => readIntervals(`/activity/${encodeURIComponent(id)}/intervals`))());

  server.registerTool("get_wellness", {
    description: "Read original Intervals.icu wellness records for a date range",
    inputSchema: { oldest: isoDate, newest: isoDate },
  }, async ({ oldest, newest }) => wrap(() => {
    if (oldest > newest) throw new Error("oldest must not be after newest");
    return readIntervals("/athlete/0/wellness", new URLSearchParams({ oldest, newest }));
  })());

  return server;
}

const mcpHandler = createMcpHandler(createServer);
const apiHandler = {
  fetch(request: Request, bindings: Env, ctx: ExecutionContext) {
    return mcpHandler(request, bindings, ctx);
  },
} satisfies ExportedHandler<Env>;

export default new OAuthProvider<Env>({
  apiHandler,
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GitHubHandler as any,
  tokenEndpoint: "/token",
  resourceMetadata: { resource: env.MCP_RESOURCE },
});
