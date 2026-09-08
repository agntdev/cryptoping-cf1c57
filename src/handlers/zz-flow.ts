import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { normalize, showMenu, state, suggestion, validTime } from "../cryptoping.js";

const composer = new Composer<Ctx>();

composer.on("message:text", async (ctx, next) => {
  const s = state(ctx); const text = ctx.message.text.trim();
  if (text.startsWith("/")) return next();
  if (s.flow === "onboard_summary_time") {
    if (!validTime(text)) { await ctx.reply("Use a local time such as 08:00."); return; }
    s.summaryEnabled = true; s.summaryTime = text; s.flow = "idle"; await ctx.reply("Morning summary saved."); await showMenu(ctx); return;
  }
  if (s.flow === "watch_add" || s.flow === "watch_edit") {
    const ticker = normalize(text); if (!ticker) { await ctx.reply(`Couldn't find ${text.toUpperCase()}.${suggestion(text)}`); return; }
    if (s.flow === "watch_add") { if (s.watchlist.includes(ticker)) { await ctx.reply(`${ticker} is already in your watchlist.`); return; } s.watchlist.push(ticker); await ctx.reply(`${ticker} was added to your watchlist.`); }
    else { const old = s.draft?.ticker; s.watchlist = s.watchlist.map((x) => x === old ? ticker : x); s.rules.forEach((r) => { if (r.ticker === old) r.ticker = ticker; }); await ctx.reply(`Watchlist ticker updated to ${ticker}.`); }
    s.draft = undefined; s.flow = "idle"; return;
  }
  if (s.flow === "alert_ticker") {
    const ticker = normalize(text); if (!ticker) { await ctx.reply(`Couldn't find ${text.toUpperCase()}.${suggestion(text)}`); return; }
    s.draft = { ticker }; s.flow = "idle"; await ctx.reply("Choose the alert type.", { reply_markup: inlineKeyboard([[inlineButton("Price threshold", "alert:type:price"), inlineButton("Percent move", "alert:type:percent")]]) }); return;
  }
  if (s.flow === "alert_value") {
    const value = Number(text.replace(/[$%\s,]/g, "")); if (!Number.isFinite(value) || value <= 0) { await ctx.reply("Send a positive number."); return; }
    s.draft = { ...s.draft, value }; s.flow = "idle"; await ctx.reply("Choose a direction.", { reply_markup: inlineKeyboard([[inlineButton("Above", "alert:direction:above"), inlineButton("Below", "alert:direction:below")], [inlineButton("Any direction", "alert:direction:any")]]) }); return;
  }
  if (s.flow === "alert_cooldown") {
    const cooldown = Number(text); if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 10080) { await ctx.reply("Use whole minutes from 1 to 10080."); return; }
    s.draft = { ...s.draft, cooldown }; s.flow = "idle"; const d = s.draft as { ticker: string; type: string; value: number; direction: string; cooldown: number }; await ctx.reply(`Ready to save your ${d.ticker} alert at ${d.value}. Cooldown: ${d.cooldown} minutes.`, { reply_markup: inlineKeyboard([[inlineButton("Save alert", "alert:confirm"), inlineButton("Cancel", "alert:cancel")]]) }); return;
  }
  if (s.flow === "price_ticker") { s.flow = "idle"; if (text.toLowerCase() === "all") { await ctx.reply("Use /price to check your whole watchlist."); return; } const ticker = normalize(text); if (!ticker) { await ctx.reply(`Couldn't find ${text.toUpperCase()}.${suggestion(text)}`); return; } await ctx.reply(`Use /price ${ticker} to check this ticker.`); return; }
  if (s.flow === "setting_quiet") { if (text.toLowerCase() === "off") { s.quietStart = undefined; s.quietEnd = undefined; s.flow = "idle"; await ctx.reply("Quiet hours are off."); return; } const [start, end, extra] = text.split("-"); if (extra || !validTime(start ?? "") || !validTime(end ?? "")) { await ctx.reply("Use HH:MM-HH:MM, for example 22:00-07:00."); return; } s.quietStart = start; s.quietEnd = end; s.flow = "idle"; await ctx.reply(`Quiet hours saved: ${start}–${end}.`); return; }
  if (s.flow === "setting_summary_time") { if (text.toLowerCase() === "off") { s.summaryEnabled = false; s.summaryTime = undefined; s.flow = "idle"; await ctx.reply("Morning summary is off."); return; } if (!validTime(text)) { await ctx.reply("Use a local time such as 08:00."); return; } s.summaryEnabled = true; s.summaryTime = text; s.flow = "idle"; await ctx.reply("Morning summary saved."); return; }
  if (s.flow === "setting_cooldown") { const n = Number(text); if (!Number.isInteger(n) || n < 1 || n > 10080) { await ctx.reply("Use whole minutes from 1 to 10080."); return; } s.defaultCooldown = n; s.flow = "idle"; await ctx.reply(`Default cooldown saved: ${n} minutes.`); return; }
  await next();
});

export default composer;
