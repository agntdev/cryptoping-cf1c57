import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { clock, ruleText, state } from "../cryptoping.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Add alert", data: "alert:add:start" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Add alert", data: "alert:add:start", order: 20 });
const composer = new Composer<Ctx>();

function chooseTicker(ctx: Ctx) { const s = state(ctx); return inlineKeyboard([...s.watchlist.map((t) => [inlineButton(t, `alert:ticker:${t}`)]), [inlineButton("Type a ticker", "alert:ticker:type")], [inlineButton("Back to menu", "menu:main")]]); }
function alertList(ctx: Ctx) { const s = state(ctx); return inlineKeyboard([...s.rules.map((r) => [inlineButton(`Edit ${r.ticker}`, `alert:edit:${r.id}`), inlineButton(`Remove ${r.ticker}`, `alert:remove:${r.id}`)]), [inlineButton("Add alert", "alert:add:start")], [inlineButton("Back to menu", "menu:main")]]); }

composer.callbackQuery("alert:add:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = state(ctx); if (s.rules.length >= 25) { await ctx.reply("You have 25 alerts already. Remove one before adding another."); return; } s.flow = "alert_ticker"; s.draft = {}; await ctx.reply("Choose a watched ticker or type one.", { reply_markup: chooseTicker(ctx) });
});
composer.callbackQuery("alerts:open", async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); await ctx.editMessageText(s.rules.length ? `Your alerts:\n${s.rules.map(ruleText).join("\n")}` : "No alerts yet — tap Add alert to create one.", { reply_markup: alertList(ctx) }); });
composer.callbackQuery(/^alert:ticker:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.draft = { ticker: ctx.match[1] }; s.flow = "idle"; await ctx.editMessageText("Choose the alert type.", { reply_markup: inlineKeyboard([[inlineButton("Price threshold", "alert:type:price"), inlineButton("Percent move", "alert:type:percent")]]) }); });
composer.callbackQuery("alert:ticker:type", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).flow = "alert_ticker"; await ctx.editMessageText("Send a ticker, for example SOL."); });
composer.callbackQuery(/^alert:type:(price|percent)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.draft = { ...s.draft, type: ctx.match[1] as "price" | "percent" }; s.flow = "alert_value"; await ctx.editMessageText(ctx.match[1] === "price" ? "Send the target price in USD." : "Send the percent move. The baseline is 24 hours."); });
composer.callbackQuery(/^alert:direction:(above|below|any)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.draft = { ...s.draft, direction: ctx.match[1] as "above" | "below" | "any" }; s.flow = "alert_cooldown"; await ctx.editMessageText(`Send a cooldown in minutes, or tap the ${s.defaultCooldown}-minute default.`, { reply_markup: inlineKeyboard([[inlineButton(`${s.defaultCooldown} minutes`, "alert:cooldown:default")]]) }); });
composer.callbackQuery("alert:cooldown:default", async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.draft = { ...s.draft, cooldown: s.defaultCooldown }; s.flow = "idle"; await confirm(ctx); });
async function confirm(ctx: Ctx) { const d = state(ctx).draft as { ticker: string; type: "price" | "percent"; value: number; direction: "above" | "below" | "any"; cooldown: number }; await ctx.editMessageText(`Save alert: ${ruleText({ id: "", ...d, enabled: true })}. Cooldown: ${d.cooldown} minutes.`, { reply_markup: inlineKeyboard([[inlineButton("Save alert", "alert:confirm"), inlineButton("Cancel", "alert:cancel")]]) }); }
composer.callbackQuery("alert:confirm", async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); const d = s.draft as { ticker: string; type: "price" | "percent"; value: number; direction: "above" | "below" | "any"; cooldown: number }; const id = `${clockSafe()}-${s.rules.length}`; s.rules.push({ id, ...d, enabled: true }); s.draft = undefined; await ctx.editMessageText(`Alert saved: ${ruleText(s.rules[s.rules.length - 1])}.`); });
function clockSafe() { return clock().toString(36); }
composer.callbackQuery("alert:cancel", async (ctx) => { await ctx.answerCallbackQuery(); state(ctx).draft = undefined; await ctx.editMessageText("Alert creation was cancelled."); });
composer.callbackQuery(/^alert:remove:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx); s.rules = s.rules.filter((r) => r.id !== ctx.match[1]); await ctx.editMessageText("Alert removed.", { reply_markup: alertList(ctx) }); });
composer.callbackQuery(/^alert:edit:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = state(ctx), r = s.rules.find((x) => x.id === ctx.match[1]); if (!r) { await ctx.editMessageText("That alert is no longer available."); return; } s.draft = { ...r }; await ctx.editMessageText(`Edit ${ruleText(r)} by choosing a direction.`, { reply_markup: inlineKeyboard([[inlineButton("Above", "alert:direction:above"), inlineButton("Below", "alert:direction:below")], [inlineButton("Any direction", "alert:direction:any")]]) }); });

export default composer;
