import type { Command } from "commander";
import pc from "picocolors";
import type { CliContext } from "../context.js";
import { table, toJson } from "../output.js";
import { getApi, type JsonOption, withJson } from "./shared.js";

export function registerCardsCommands(program: Command, ctx: CliContext): void {
  const cards = program.command("cards").description("saved payment methods");

  withJson(cards.command("list").description("list saved cards")).action(
    async (opts: JsonOption) => {
      const api = getApi(ctx);
      const { paymentMethods } = await api.listPaymentMethods();
      if (opts.json) {
        ctx.out(toJson(paymentMethods));
        return;
      }
      if (paymentMethods.length === 0) {
        ctx.out("No saved cards. Add one in the wallet website.");
        return;
      }
      const rows = paymentMethods.map((pm) => {
        const brand = pm.card?.brand ?? pm.type;
        const last4 = pm.card?.last4 ? `••${pm.card.last4}` : "";
        const exp = pm.card?.expiration
          ? `${pm.card.expiration.month}/${pm.card.expiration.year}`
          : "";
        return [
          `${brand} ${last4}`.trim(),
          exp,
          pm.paymentMethodId,
          pm.default ? pc.dim("default") : "",
        ];
      });
      for (const line of table(rows)) ctx.out(line.trimEnd());
    },
  );
}
