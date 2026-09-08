import type { Ctx } from "./bot.js";
import { inlineButton, inlineKeyboard } from "./toolkit/index.js";

export type Flow = "idle" | "onboard_timezone" | "onboard_summary" | "onboard_summary_time" | "watch_add" | "watch_edit" | "alert_ticker" | "alert_value" | "alert_cooldown" | "price_ticker" | "setting_quiet" | "setting_summary_time" | "setting_cooldown";
export type Direction = "above" | "below" | "any";
export interface Rule { id: string; ticker: string; type: "price" | "percent"; value: number; direction: Direction; cooldown: number; lastFiredAt?: number; enabled: boolean; }
export interface AppState { flow: Flow; timezone: string; summaryEnabled: boolean; summaryTime?: string; quietStart?: string; quietEnd?: string; defaultCooldown: number; watchlist: string[]; rules: Rule[]; draft?: Partial<Rule> & { ticker?: string }; lastPrices: Record<string, { price: number; checkedAt: number; change24h?: number }>; queued: string[]; }
type SessionState = Ctx["session"] & { cryptoping?: AppState };

const KNOWN: Record<string, { id: string; name: string }> = {
  BTC: { id: "bitcoin", name: "Bitcoin" }, ETH: { id: "ethereum", name: "Ethereum" }, TON: { id: "the-open-network", name: "Toncoin" }, SOL: { id: "solana", name: "Solana" }, USDT: { id: "tether", name: "Tether" }, XRP: { id: "ripple", name: "XRP" },
};
export const clock = () => Date.now();

export function state(ctx: Ctx): AppState {
  const session = ctx.session as SessionState;
  return (session.cryptoping ??= { flow: "idle", timezone: "UTC", summaryEnabled: false, defaultCooldown: 60, watchlist: ["BTC", "ETH", "TON"], rules: [], lastPrices: {}, queued: [] });
}
export function menu() { return inlineKeyboard([[inlineButton("Watchlist", "watchlist:open"), inlineButton("Add alert", "alert:add:start")], [inlineButton("Prices", "price:open"), inlineButton("Settings", "settings:open")], [inlineButton("Alerts", "alerts:open")], [inlineButton("Back to menu", "menu:main")]]); }
export function normalize(raw: string): string | undefined { const t = raw.trim().toUpperCase(); return KNOWN[t] ? t : undefined; }
export function suggestion(raw: string): string { const t = raw.trim().toUpperCase(); const close = Object.keys(KNOWN).filter((x) => x.includes(t.slice(0, 2)) || t.slice(0, 2).includes(x.slice(0, 2))).slice(0, 3); return close.length ? ` Try ${close.join(", ")}.` : " Use a common ticker such as BTC, ETH, TON, SOL, USDT, or XRP."; }
export function ruleText(r: Rule): string { return r.type === "price" ? `${r.ticker} ${r.direction} $${r.value}` : `${r.ticker} moves ${r.direction} ${r.value}%`; }
export function fmt(n: number): string { return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toLocaleString("en-US", { maximumFractionDigits: 6 }); }
export function validTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function localMinutes(timezone: string, at = clock()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
  return Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
}
export function quiet(s: AppState, at = clock()): boolean { if (!s.quietStart || !s.quietEnd) return false; const [sh, sm] = s.quietStart.split(":").map(Number); const [eh, em] = s.quietEnd.split(":").map(Number); const start = sh * 60 + sm, end = eh * 60 + em, now = localMinutes(s.timezone, at); return start === end ? false : start < end ? now >= start && now < end : now >= start || now < end; }
export async function prices(tickers: string[]): Promise<Record<string, { price: number; change24h?: number }>> {
  const ids = tickers.map((t) => KNOWN[t]?.id).filter(Boolean); if (!ids.length) return {};
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&include_24hr_change=true`);
  if (!response.ok) throw new Error("price feed unavailable");
  const json = await response.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
  return Object.fromEntries(tickers.flatMap((ticker) => { const row = json[KNOWN[ticker].id]; return typeof row?.usd === "number" ? [[ticker, { price: row.usd, change24h: row.usd_24h_change }]] : []; }));
}
export async function showMenu(ctx: Ctx, edit = false) { const text = "CryptoPing keeps your watchlist and alerts private."; if (edit) await ctx.editMessageText(text, { reply_markup: menu() }); else await ctx.reply(text, { reply_markup: menu() }); }
