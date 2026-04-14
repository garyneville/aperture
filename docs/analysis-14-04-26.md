Aperture Pipeline Health Report — Tuesday 14 April 2026

  What's Working

  Core pipeline is solid. End-to-end execution completed successfully: 10/12
  APIs fetched, scoring produced sensible results, editorial generated, both
  consumer and debug emails delivered at 06:34 UTC via SendGrid (DKIM pass, SPF
  pass).

  Scoring engine is producing rich, nuanced output. Multi-dimensional hourly
  scoring (drama, clarity, mist, astro, crepuscular) plus 9 session-specific
  scores (long-exposure 98, wildlife 71, waterfall 68, urban 66, mist 66, astro
  48, golden-hour 27) — each with confidence levels, volatility, reasons, and
  warnings. The best-hour identification (06:00, score 42, 0% high cloud, 8.9km
  vis, calm wind) makes sense for the conditions.

  Alt location system is impressive. 8 nearby alternatives scored with Bortle
  class, dark sky deltas, and drive times. 37 long-range locations evaluated
  with threshold reasoning visible in the debug trace. Weekend opportunities
  surfaced intelligently (Ullswater 86/100, Castlerigg dark sky alert).

  AI fallback worked exactly as designed. Gemini returned 503 ("high demand"),
  system seamlessly fell back to Groq, produced coherent editorial in 1715
  bytes. Spur-of-the-moment suggestion (Mam Tor) was correctly deduplicated
  against the nearby alts list.

  Debug email is excellent observability. Window selection trace, hourly scoring
   trace with per-session breakdowns, alt location scoring with delta
  calculations, AI editorial trace showing both raw provider responses, kit
  advisory rule trace, outdoor comfort window trace, and payload snapshots with
  sizes. This is a proper production debug tool.

  Email design is polished. Dark mode CSS support, MJML-based responsive layout,
   multipart (text/plain + text/html), car wash forecast, 5-day outlook with
  visual bar chart.

  ---
  What's Not Working

  1. SunsetHue API → 400 "No API key" — The snapshot script can't find the
  SUNSETHUE_API_KEY. Production had it (Hue rise 41%, set 0% shown in the
  email), so this is a snapshot-script env issue only.
  2. NASA DONKI CME → 503 — Upstream service failure. Using DEMO_KEY which is
  rate-limited. Aurora/CME data is missing from this snapshot.
  3. Gemini AI → 503 — "This model is currently experiencing high demand."
  Fallback saved the run, but you're operating on a single AI provider for
  editorial today.
  4. dump-pipeline.ts broken with ts-node/esm — The usage comment says node
  --loader ts-node/esm but it fails on astronomy-engine CJS/ESM incompatibility.
   Works with npx tsx — the docs need updating.
  5. Snapshot script only fetches 1 alt location (Malham Cove) — Production
  scored 37+ locations. The pipeline dump can't replicate production scoring
  because it's missing weather data for the other 36 locations.

  ---
  What's Going Well

  - Resilience — Two external failures (Gemini, NASA DONKI) and the pipeline
  delivered a complete, useful email anyway. No data gaps visible to the end
  user.
  - Scoring transparency — The debug email makes every decision auditable: why
  window X was chosen, why location Y was excluded ("astro score below threshold
   (59 < 60)"), why session Z was gated.
  - Editorial prompt engineering — The AI prompt is exceptionally
  well-constrained (word limits, forbidden patterns, required references to the
  actual window). The Groq output is concise and factual: no hallucinated
  conditions, no hype.
  - METAR cross-validation — "Clear skies confirmed" matches the low-cloud
  scoring at dawn hours.

  ---
  What Could Be Improved

  1. Email arrives after the best window. Sent at 06:34, best window was 06:00.
  The editorial itself acknowledges "the window has passed" which is honest but
  not useful. Consider sending earlier or recommending the next available window
   more prominently.
  2. 100/100 session score vs 42/100 day score is confusing. The consumer email
  headlines "06:00 [100/100]" but the hero card shows "42". The debug email
  clarifies these are different metrics, but a user might wonder why their
  "100/100" day is labelled "Marginal".
  3. Window range "06:00-06:00" — A single-hour window displaying as a range to
  itself looks like a bug. Show it as just "06:00" or "06:00–07:00".
  4. All alt locations show as "astrophotography" — Accurate (astro is best
  genre there), but at 6:30am it reads oddly. Could note the next astro window
  time more prominently or also show daytime genre scores.
  5. Snapshot script coverage gap — Extend it to fetch all configured
  alt-location weather, not just Malham Cove. Without this, the pipeline dump
  can't reproduce real scoring.
  6. NASA DEMO_KEY — Get a real API key for DONKI to avoid rate limit issues.
  It's free to register.
  7. Third AI provider fallback — With Gemini down, you're one Groq outage away
  from no editorial. Consider adding a third provider (e.g. Claude API, OpenAI)
  or retry with backoff for transient 503s.
  8. Best session confidence is "Fair" but email says "best chance" — The
  editorial trace shows confidence "Fair" and volatility 11, but the consumer
  email labels this as "[best chance]". These feel contradictory. Fair
  confidence with best-chance labelling might overstate reliability.