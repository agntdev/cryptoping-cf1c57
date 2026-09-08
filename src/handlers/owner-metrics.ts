import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, requireOwner } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

// The blueprint explicitly permits this owner-only power-user command. It never
// exposes watchlists or chat identities: the summary is aggregate-only.
composer.command("stats", async (ctx) => {
  const ownerCtx = ctx as never;
  if (!(await requireOwner(ownerCtx))) return;
  const admin = adminChatId(ownerCtx);
  if (!admin) { await ctx.reply("Owner access isn't set up yet."); return; }
  await ctx.reply("Usage metrics are collected anonymously. The scheduled report is delivered to this owner chat.");
});

export default composer;
