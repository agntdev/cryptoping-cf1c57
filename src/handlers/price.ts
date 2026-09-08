import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { clock, fmt, normalize, prices, state, suggestion } from "../cryptoping.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.

registerMainMenuItem({ label: "Prices", data: "price:open", order: 30 });
const composer = new Composer<Ctx>();

async function quote(ctx: Ctx, requested: string[], edit = false) {
  const s = state(ctx);
  try {
    const found = await prices(requested);
    if (!Object.keys(found).length) { const text = "Couldn't find that ticker."; if (edit) await ctx.editMessageText(text); else await ctx.reply(text); return; }
    const text = Object.entries(found).map(([ticker, row]) => { const old = s.lastPrices[ticker]?.price; const change = old ? ((row.price - old) / old) * 100 : row.change24h; s.lastPrices[ticker] = { price: row.price, checkedAt: clock(), change24h: row.change24h }; return `${ticker} $${fmt(row.price)}${typeof change === "number" ? ` (${change >= 0 ? "+" : ""}${change.toFixed(2)}%)` : ""}`; }).join("\n");
    if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Refresh", `price:refresh:${requested.join(",")}`)], [inlineButton("Back to menu", "menu:main")]]) }); else await ctx.reply(text);
  } catch { const text = "Price feed is temporarily unavailable. Try again shortly."; if (edit) await ctx.editMessageText(text); else await ctx.reply(text); }
}

composer.command("price", async (ctx) => {
  const arg = ctx.match?.trim(); if (!arg) { await quote(ctx, state(ctx).watchlist); return; }
  const ticker = normalize(arg); if (!ticker) { await ctx.reply(`Couldn't find ${arg.trim().toUpperCase()}.${suggestion(arg)}`); return; } await quote(ctx, [ticker]);
});
composer.callbackQuery("price:open", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "price_ticker"; await ctx.editMessageText("Send a ticker for a current price, or send all for your watchlist."); });
composer.callbackQuery(/^price:refresh:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await quote(ctx, ctx.match[1].split(","), true); });

export default composer;
