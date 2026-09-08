import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { state } from "../cryptoping.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Manage watchlist", data: "watchlist:open" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Watchlist", data: "watchlist:open", order: 10 });
const composer = new Composer<Ctx>();

function keyboard(ctx: Ctx) { const s = state(ctx); return inlineKeyboard([...s.watchlist.map((t) => [inlineButton(`Edit ${t}`, `watchlist:edit:${t}`), inlineButton(`Remove ${t}`, `watchlist:remove:${t}`)]), [inlineButton("Add ticker", "watchlist:add")], [inlineButton("Back to menu", "menu:main")]]); }

composer.callbackQuery("watchlist:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = state(ctx); await ctx.reply(`Your watchlist: ${s.watchlist.join(", ")}.`, { reply_markup: keyboard(ctx) });
});
composer.callbackQuery("watchlist:add", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "watch_add"; await ctx.editMessageText("Send a ticker to add, for example SOL."); });
composer.callbackQuery(/^watchlist:edit:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.flow = "watch_edit"; s.draft = { ticker: ctx.match[1] }; await ctx.editMessageText(`Send the replacement ticker for ${ctx.match[1]}.`); });
composer.callbackQuery(/^watchlist:remove:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx), t = ctx.match[1]; if (s.watchlist.length <= 1) { await ctx.editMessageText("Keep at least one ticker in your watchlist.", { reply_markup: keyboard(ctx) }); return; } s.watchlist = s.watchlist.filter((x) => x !== t); s.rules = s.rules.filter((r) => r.ticker !== t); await ctx.editMessageText(`${t} was removed.`, { reply_markup: keyboard(ctx) }); });

export default composer;
