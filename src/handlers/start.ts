import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { showMenu, state } from "../cryptoping.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "CryptoPing tracks private crypto prices and alerts.";

composer.command("start", async (ctx) => {
  const s = state(ctx);
  if (s.flow === "idle" && !s.summaryTime && s.timezone === "UTC" && !s.summaryEnabled) {
    s.flow = "onboard_timezone";
    await ctx.reply(`${WELCOME}\n\nChoose your timezone.`, { reply_markup: inlineKeyboard([[inlineButton("UTC", "onboard:tz:UTC"), inlineButton("Europe/London", "onboard:tz:Europe/London")], [inlineButton("America/New_York", "onboard:tz:America/New_York")], [inlineButton("Skip — UTC", "onboard:tz:UTC")]]) });
    return;
  }
  await showMenu(ctx);
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showMenu(ctx, true);
});

composer.callbackQuery(/^onboard:tz:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.timezone = ctx.match[1]; s.flow = "onboard_summary"; await ctx.editMessageText("Would you like a morning summary?", { reply_markup: inlineKeyboard([[inlineButton("Enable", "onboard:summary:yes"), inlineButton("Not now", "onboard:summary:no")]]) }); });
composer.callbackQuery("onboard:summary:no", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "idle"; await showMenu(ctx, true); });
composer.callbackQuery("onboard:summary:yes", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "onboard_summary_time"; await ctx.editMessageText("Send the local time for your summary, for example 08:00."); });

export default composer;
