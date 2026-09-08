# CryptoPing — Private Price Watch — Bot specification

**Archetype:** finance

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A personal Telegram bot that lets individual crypto traders privately track tickers, create threshold and percent-move alerts with cooldowns, request on-demand prices, and optionally receive a daily morning summary. Alerts respect user-configured quiet hours and are delivered only to the user's private chat; the bot sends anonymized aggregated usage metrics to the owner/admin chat.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Individual crypto traders
- Crypto holders who want private low-noise price alerts

## Success criteria

- Users can complete onboarding and set their timezone and optional morning summary time.
- Users can add/remove tickers to a personal watchlist (seeded with BTC/ETH/TON).
- Users can create price-threshold and percent-move alerts, and receive an alert message when a rule triggers.
- Alerts are suppressed during quiet hours and queued as a single summary when quiet ends (if applicable).
- Per-rule cooldowns prevent repeated alerts for the same rule within the cooldown window.
- Users can request /price for a ticker or all watched tickers and receive current prices and percent changes.
- Owner/admin receives anonymized aggregated metrics and top-fired alerts in ADMIN_CHAT_ID.

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and start onboarding (ask timezone and morning summary opt-in).
- **Manage watchlist** (button, actor: user, callback: watchlist:open) — Open the watchlist manager (seeded coins shown; add, edit, remove).
  - outputs: Inline list of watchlist items with Edit and Remove buttons, Button to Add custom ticker
- **Add alert** (button, actor: user, callback: alert:add:start) — Guided flow to create a new alert for a chosen or typed ticker.
  - inputs: Choice of coin from watchlist (button) OR typed ticker (ForceReply), Alert type selection (price threshold or percent-move), Threshold value or percent, direction selection (above/below/any), Cooldown minutes (optional)
  - outputs: Confirmation message summarizing saved alert rule
- **/price** (command, actor: user, command: /price) — Return current price for a ticker or all watched tickers. Use typed input for ticker or nothing for all.
  - inputs: Optional ticker parameter (e.g., /price BTC)
  - outputs: Current price and percent change since last-known price or 24h if no prior value, Helpful suggestions/corrections for unknown tickers
- **Settings** (button, actor: user, callback: settings:open) — Open settings to configure timezone, quiet hours, morning summary time, and cooldown defaults.
  - outputs: Settings menu with options to edit timezone, quiet hours, summary time, and defaults
- **/help** (command, actor: user, command: /help) — Fallback help text explaining core commands and common actions.
  - outputs: Concise usage help and links to key buttons/flows

## Flows

### Onboarding
_Trigger:_ /start

1. Send brief intro and value proposition
2. Ask for preferred timezone (button list + 'skip' default to UTC)
3. Ask whether to enable morning summary (yes/no) and if yes ask for local time
4. Save user profile (chat id, timezone, morning summary setting) and present main menu

_Data touched:_ UserProfile, Settings

### Manage Watchlist
_Trigger:_ callback watchlist:open

1. Show seeded coins (BTC, ETH, TON) and user's current watchlist items with inline Edit/Remove buttons
2. Add custom ticker via ForceReply typed input
3. Normalize and validate ticker (suggest close matches on typo)
4. Persist watchlist item and confirm to user

_Data touched:_ WatchlistItem, LastKnownPrice

### Add Alert (guided)
_Trigger:_ callback alert:add:start

1. Ask user to choose a coin from watchlist (buttons) or type a ticker (ForceReply)
2. Ask for alert type: price threshold OR percent-move (buttons)
3. If threshold: ask for target price (typed input). If percent: ask for percent and baseline window (use 24h baseline if unspecified).
4. Ask for direction: above / below / any (buttons).
5. Show summary and ask for confirmation (confirm/cancel buttons). On confirm, persist AlertRule with default cooldown and acknowledge.

_Data touched:_ AlertRule, WatchlistItem, UserProfile

### Edit/Delete Alert
_Trigger:_ callback alert:edit:* or alert:remove:*

1. Show current rule parameters, allow changing threshold/percent/direction/cooldown, or confirm deletion
2. Validate edits and persist changes, or remove rule and confirm

_Data touched:_ AlertRule

### Price Query
_Trigger:_ /price [ticker|none]

1. Validate ticker(s). For unknown ticker suggest closest matches and offer ForceReply correction.
2. Fetch latest price(s) from price feed and compute percent change since last-known price or 24h baseline if no prior.
3. Return a compact list or single entry with price, percent change, and timestamp. Update LastKnownPrice store for those tickers.

_Data touched:_ LastKnownPrice, UsageMetrics

### Alert Evaluation Engine (polling job)
_Trigger:_ scheduled poll (platform scheduler or cron)

1. For each active user, fetch necessary tickers' current prices (batch requests when possible)
2. For each user's alert rule, determine if condition met (threshold or percent threshold) and check cooldown and quiet hours
3. If quiet hours active: queue the alert for end-of-quiet summary (do not send individual alert)
4. If not suppressed, send single alert message with old price, new price, absolute and percent change, and timestamp; update rule's last-fired timestamp to enforce cooldown.
5. On transient price feed failures: retry up to 3 times over ~1 minute silently; if still failing, mark as degraded for that user/ticker and do not raise alerts for it; if failure persists >1 hour, notify user and owner (ADMIN_CHAT_ID).
6. Update usage metrics per alert-fire and ticker

_Data touched:_ AlertRule, LastKnownPrice, CooldownTimer, UsageMetrics, Settings

### Morning Summary Job
_Trigger:_ scheduled at each user's chosen local time

1. If user opted-in, skip if in quiet hours and instead mark summary to be delivered after quiet hours end (single queued summary)
2. Fetch current prices and 24h changes for user's watchlist
3. Compute and highlight alerts that are 'close to firing' (configurable delta, default missing field) and include them in the summary
4. Send concise summary message to user's private chat

_Data touched:_ UserProfile, WatchlistItem, LastKnownPrice, UsageMetrics

### Quiet Hours End Summary
_Trigger:_ quiet hours end for a user with queued alerts

1. Compile queued alerts/events that occurred during quiet hours into a single summary message
2. Send the single summary message to the user and clear the queue

_Data touched:_ Settings, QueuedAlerts

### Owner Metrics Delivery
_Trigger:_ scheduled (frequency missing_field) OR on-demand

1. Aggregate anonymized metrics: active user count, top 10 most-fired tickers, top 10 most-fired alert rules, alert counts per day
2. Send aggregated report to ADMIN_CHAT_ID; include recent persistent failures if any

_Data touched:_ UsageMetrics, OwnerNotifications

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where aggregated usage and persistent failure notifications are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **UserProfile** _(retention: persistent)_ — Per-user identity and locale settings
  - fields: chat_id, timezone, morning_summary_enabled, morning_summary_time, created_at, last_seen
- **WatchlistItem** _(retention: persistent)_ — A single watched ticker for a user
  - fields: user_chat_id, ticker_symbol, display_name, added_at, source_hint
- **AlertRule** _(retention: persistent)_ — User-configured alert rule per ticker
  - fields: rule_id, user_chat_id, ticker_symbol, type, threshold_price, percent_threshold, direction, cooldown_minutes, last_fired_at, created_at, enabled
- **Settings** _(retention: persistent)_ — Per-user preferences like quiet hours and defaults
  - fields: user_chat_id, quiet_hours_start, quiet_hours_end, cooldown_default_minutes, price_source_fallback_behavior
- **LastKnownPrice** _(retention: persistent)_ — Most recent successfully fetched price per ticker per user context
  - fields: ticker_symbol, last_price, last_checked_at, reference_window_for_percent
- **CooldownTimer** _(retention: persistent)_ — Track cooldown per rule to suppress repeated alerts
  - fields: rule_id, cooldown_expires_at
- **UsageMetrics** _(retention: persistent)_ — Anonymized aggregated counters for owner reporting
  - fields: date, active_user_count, alert_fire_counts_by_ticker, alert_fire_counts_by_rule
- **QueuedAlerts** _(retention: session)_ — Temporary storage for alerts suppressed during quiet hours to be delivered as a single summary
  - fields: user_chat_id, queued_event_ids, queued_since

## Integrations

- **Telegram** (required) — Bot API messaging and callback handling
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Receive aggregated anonymized usage metrics and top-fired tickers/alerts in ADMIN_CHAT_ID
- Receive persistent price-feed failure notifications if outages affect many users
- Command in admin chat to request on-demand aggregated stats (e.g., /stats) — implementable as owner-only command

## Notifications

- User alert message when a rule triggers (includes coin, old price, new price, absolute and percent change, timestamp)
- Queued summary delivery when quiet hours end (single message summarizing suppressed alerts)
- Morning summary at user-chosen local time (if enabled) with watched coins and 24h changes
- Persistent price-feed failure notification to the user for that ticker if failure > 1 hour
- Persistent price-feed failure notification and aggregated failure report to ADMIN_CHAT_ID

## Permissions & privacy

- All user watchlists, alert rules, and last-known prices are private and only sent to the user's private chat.
- Owner receives only anonymized aggregated metrics (active user count, top-fired tickers/alerts). No per-user watchlist contents are reported.
- Users can request export or deletion of their data via settings (implement as owner-provided commands/buttons).
- Bot will not broadcast to public groups in the initial build (non-goal).

## Edge cases

- Unknown ticker or ambiguous symbol: suggest close matches and accept user correction; if still unknown, explain expected ticker format.
- Ticker collisions or multiple markets (BTC vs BTCUSDT): normalization rules unknown — placed in missing_fields.
- Quiet hours that cross midnight: ensure suppressed alerts queue and single summary delivered when quiet ends.
- User changes timezone after creating alerts: alerts and scheduled summaries must respect the new timezone; document that scheduled jobs should re-evaluate next run.
- Price feed transient errors: retry up to 3 times across ~1 minute silently; do not trigger alerts on partial/failed reads.
- Sustained price feed outage: do not send false alerts; notify users and owner after configured persistent-failure threshold (>1 hour by default).
- Overlapping alerts for same ticker and similar thresholds: rely on per-rule cooldowns to avoid duplicated messages.
- Bot restarts: cooldowns and last-known prices persisted to avoid duplicate alerts after restart.
- Rate limits on price API: must batch ticker requests per owner/user where possible; specifics depend on chosen provider (missing_fields).
- User rapidly creates many alerts: protect backend with sensible per-user limits (missing_field: max alerts per user).

## Required tests

- Dialog-level acceptance test: complete onboarding with timezone and morning summary opt-in
- Dialog-level acceptance test: add custom ticker to watchlist, then add price threshold alert and receive confirmation
- Dialog-level acceptance test: create percent-move alert, simulate price movement that triggers it, verify alert delivered with expected payload and cooldown enforced
- Dialog-level acceptance test: /price for single ticker and for all watched tickers; unknown ticker suggestion path
- Quiet hours test: create alert that triggers during quiet hours and verify it is queued and summarized after quiet ends as a single message
- Cooldown test: verify repeated price changes inside cooldown window do not send repeated alerts
- Resilience test: simulate transient price feed errors and verify no false alerts and that persistent failure >1 hour triggers user+owner notifications
- Morning summary test: user receives daily summary at configured local time, respects quiet hours
- Owner metrics delivery test: aggregated anonymized stats delivered to ADMIN_CHAT_ID and contain top-fired tickers
- Persistence test: restart bot and verify last-known prices, alert rules, and cooldowns persist and function correctly

## Assumptions

- Default timezone is UTC if user skips selecting timezone during onboarding.
- Seed watchlist includes Bitcoin (BTC), Ethereum (ETH), and Toncoin (TON) to speed onboarding.
- Default cooldown is 60 minutes per rule unless user overrides when creating/editing the rule.
- Price source retry policy: quietly retry up to 3 times across ~1 minute before suppressing alert; notify user if failure persists >1 hour.
- Morning summary is off by default; users must opt in and choose a local time.
- All alerts and summaries are delivered only to the user's private chat by design.
