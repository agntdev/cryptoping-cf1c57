import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { state } from "../cryptoping.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Settings", data: "settings:open" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Settings", data: "settings:open", order: 40 });
const composer = new Composer<Ctx>();
function settings(ctx: Ctx) { const s = state(ctx); return { text: `Timezone: ${s.timezone}\nQuiet hours: ${s.quietStart && s.quietEnd ? `${s.quietStart}–${s.quietEnd}` : "Off"}\nMorning summary: ${s.summaryEnabled ? s.summaryTime : "Off"}\nDefault cooldown: ${s.defaultCooldown} minutes`, reply_markup: inlineKeyboard([[inlineButton("Timezone", "settings:timezone"), inlineButton("Quiet hours", "settings:quiet")], [inlineButton("Morning summary", "settings:summary"), inlineButton("Cooldown", "settings:cooldown")], [inlineButton("Export data", "settings:export"), inlineButton("Delete data", "settings:delete")], [inlineButton("Back to menu", "menu:main")]]) }; }

composer.callbackQuery("settings:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Update your private preferences.", settings(ctx));
});
composer.callbackQuery("settings:timezone", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Choose your timezone.", { reply_markup: inlineKeyboard([[inlineButton("UTC", "settings:tz:UTC"), inlineButton("Europe/London", "settings:tz:Europe/London")], [inlineButton("America/New_York", "settings:tz:America/New_York")]]) }); });
composer.callbackQuery(/^settings:tz:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).timezone = ctx.match[1]; await ctx.editMessageText("Timezone saved.", settings(ctx)); });
composer.callbackQuery("settings:quiet", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "setting_quiet"; await ctx.editMessageText("Send quiet hours as HH:MM-HH:MM, for example 22:00-07:00. Send off to disable them."); });
composer.callbackQuery("settings:summary", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "setting_summary_time"; await ctx.editMessageText("Send a local summary time as HH:MM, or send off."); });
composer.callbackQuery("settings:cooldown", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "setting_cooldown"; await ctx.editMessageText("Send the default cooldown in whole minutes."); });
composer.callbackQuery("settings:export", async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); await ctx.editMessageText(`Your data: timezone ${s.timezone}; watchlist ${s.watchlist.join(", ")}; ${s.rules.length} alert rules.`, settings(ctx)); });
composer.callbackQuery("settings:delete", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText("Delete all private data?", { reply_markup: inlineKeyboard([[inlineButton("Delete data", "settings:delete:yes"), inlineButton("Keep it", "settings:open")]]) }); });
composer.callbackQuery("settings:delete:yes", async (ctx) => { await ctx.answerCallbackQuery(); const session = ctx.session as Ctx["session"] & { cryptoping?: unknown }; delete session.cryptoping; await ctx.editMessageText("Your private data was deleted."); });

export default composer;
