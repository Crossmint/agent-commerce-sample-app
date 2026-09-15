import type { Command } from "commander";
import pc from "picocolors";
import type { CliContext } from "../context.js";
import { login, logout } from "../login.js";
import { kv, toJson } from "../output.js";
import { getApi, type JsonOption, withJson } from "./shared.js";

export function registerAuthCommands(program: Command, ctx: CliContext): void {
  withJson(
    program
      .command("login")
      .description("log in through the browser (OAuth PKCE)")
      .option("--api <url>", "GOAT API base URL, e.g. https://wallet.example.com/api/goat")
      .option("--code", "no local browser: print a URL and paste the code back"),
  ).action(async (opts: JsonOption & { api?: string; code?: boolean }) => {
    await login(ctx, { api: opts.api, code: opts.code, json: opts.json });
  });

  withJson(program.command("logout").description("forget the saved session")).action(
    async (opts: JsonOption) => {
      const result = await logout(ctx);
      if (opts.json) ctx.out(toJson({ loggedOut: true, ...result }));
      else ctx.out("Logged out.");
    },
  );

  withJson(program.command("whoami").description("show the logged in user")).action(
    async (opts: JsonOption) => {
      const api = getApi(ctx);
      const me = await api.me();
      if (opts.json) {
        ctx.out(toJson({ ...me, apiBaseUrl: api.baseUrl }));
        return;
      }
      ctx.out(`${pc.green("Logged in as")} ${pc.bold(me.email ?? me.userId)}`);
      for (const line of kv([
        ["User id", me.userId],
        ["API", api.baseUrl],
      ]))
        ctx.out(line);
    },
  );
}
