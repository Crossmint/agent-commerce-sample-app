import { errorResponse } from "./errors.js";

export type Method = "GET" | "POST" | "PUT" | "DELETE";
export type Params = Record<string, string>;
export type RouteHandler<Ctx> = (req: Request, ctx: Ctx, params: Params) => Promise<Response>;

interface Route<Ctx> {
  method: Method;
  segments: string[];
  handler: RouteHandler<Ctx>;
}

/**
 * A tiny matcher for Web-standard Request → Response.
 * The mount prefix is whatever comes before "/v1/" in the URL path.
 * Patterns look like "/v1/agent-cards/:id/credentials".
 */
export class Router<Ctx> {
  private readonly routes: Route<Ctx>[] = [];

  add(method: Method, pattern: string, handler: RouteHandler<Ctx>): this {
    this.routes.push({ method, segments: split(pattern), handler });
    return this;
  }

  get(pattern: string, handler: RouteHandler<Ctx>): this {
    return this.add("GET", pattern, handler);
  }
  post(pattern: string, handler: RouteHandler<Ctx>): this {
    return this.add("POST", pattern, handler);
  }
  put(pattern: string, handler: RouteHandler<Ctx>): this {
    return this.add("PUT", pattern, handler);
  }
  delete(pattern: string, handler: RouteHandler<Ctx>): this {
    return this.add("DELETE", pattern, handler);
  }

  async dispatch(req: Request, ctx: Ctx): Promise<Response> {
    const path = routePath(new URL(req.url).pathname);
    if (path === null) return errorResponse(404, "not_found", "No /v1/ segment in path");
    const segments = split(path);
    let pathMatched = false;
    for (const route of this.routes) {
      const params = match(route.segments, segments);
      if (!params) continue;
      pathMatched = true;
      if (route.method !== req.method.toUpperCase()) continue;
      return route.handler(req, ctx, params);
    }
    if (pathMatched) {
      return errorResponse(405, "invalid_request", `Method ${req.method} not allowed for ${path}`);
    }
    return errorResponse(404, "not_found", `No route for ${req.method} ${path}`);
  }
}

/** "/api/goat/v1/me" → "/v1/me". Null when "/v1/" is absent. */
export function routePath(pathname: string): string | null {
  const idx = pathname.indexOf("/v1/");
  if (idx === -1) return pathname.endsWith("/v1") ? "/v1" : null;
  return pathname.slice(idx);
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function match(pattern: string[], actual: string[]): Params | null {
  if (pattern.length !== actual.length) return null;
  const params: Params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]!;
    const a = actual[i]!;
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(a);
    } else if (p !== a) {
      return null;
    }
  }
  return params;
}
