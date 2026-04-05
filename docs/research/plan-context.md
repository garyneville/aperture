❯ If you familiarise yourself with                                                     
/Users/chrisdearnley/Documents/vscode/aperture/docs/architecture.md - and quick scan   
of the codebase - you understand what the solution is attempting to do.  Give me a     
deep research prompt to further gather info that will help improve this solution?      

  Read 1 file, listed 1 directory (ctrl+o to expand)

⏺ Explore(Quick scan of Aperture codebase)
  ⎿  Done (49 tool uses · 75.8k tokens · 1m 47s)
  (ctrl+o to expand)

⏺ Now I have a thorough understanding. Here's a deep research prompt tailored to the
  specific gaps and opportunities in Aperture:

  ---
  Deep Research Prompt

  Context: I'm building "Aperture" — an automated photography weather briefing system.
  It ingests weather forecasts (Open-Meteo, air quality, aurora feeds), scores hourly
  conditions across 7 photography session types (golden hour, astro, mist, storm, long
  exposure, urban, wildlife), generates AI editorial via Groq/Gemini, and delivers
  scored briefs via email, static site, Telegram, and JSON. The scoring uses derived
  features like optical thickness, haze trap risk (boundary-layer height + aerosol
  optical depth), astronomical seeing proxies (CAPE + wind shear), ensemble cloud-cover
   confidence, and Krisciunas-Schaefer moon brightness modelling. It runs on n8n but is
   architecturally decoupled from it.

  I need research across these areas to improve the system:

  ---
  1. Atmospheric Optics & Scoring Accuracy

  - What are the most reliable proxy signals for predicting vivid sunrise/sunset colour
   from numerical weather model output? Beyond cloud percentage, what role do aerosol
  optical depth, humidity profiles, and cloud altitude play in predicting
  orange/red/pink skies vs grey washouts?
  - What peer-reviewed or empirically validated models exist for predicting crepuscular
   ray likelihood from forecast data? What atmospheric conditions (cloud gaps at
  specific altitudes, solar angle ranges) produce them?
  - My system estimates astronomical seeing from CAPE, vertical wind shear, and
  boundary-layer height. How do professional astronomers and astrophotographers assess
  seeing forecasts? What are the best available proxy models when actual turbulence
  profiling (e.g., DIMM measurements) isn't available? How do services like Meteoblue's
   seeing forecast or Clear Outside derive their predictions?
  - What is the current state-of-the-art for fog/mist prediction at the hyperlocal
  level using publicly available forecast models? My mist session scoring would benefit
   from understanding which model variables best predict valley fog, radiation fog, and
   advection fog within a 6-hour window.

  2. Photography Session Science

  - For landscape astrophotography, what are the quantitative thresholds that
  experienced astrophotographers use for: Bortle class viability, moon
  altitude/illumination wash-out limits, transparency vs seeing trade-offs, and minimum
   useful dark-sky window duration?
  - What weather conditions most reliably produce dramatic storm photography
  opportunities (shelf clouds, mammatus, wall clouds, lightning)? Beyond CAPE, what
  combination of forecast variables (lifted index, bulk shear, storm-relative helicity,
   precipitable water) best predict photogenic convective storms in the UK/Northern
  Europe context?
  - For long exposure seascapes and waterfall photography, what wind speed and gust
  thresholds actually matter for composition viability? Are there published guidelines
  from professional landscape photographers on wind tolerances for different focal
  lengths and exposure times?
  - What conditions predict good wildlife photography light — the soft, warm, even
  illumination that wildlife photographers prize? Is there research on optimal cloud
  cover percentages, solar angles, and diffuse-to-direct light ratios?

  3. Forecast Confidence & Ensemble Methods

  - What are the best practices for communicating forecast uncertainty to
  non-meteorologist end users? How do weather apps and photography-specific tools
  (PhotoPills, Clear Outside, Windy) handle ensemble spread and model disagreement?
  - My system uses ensemble cloud-cover standard deviation as a confidence metric. Are
  there more sophisticated approaches? How do meteorologists derive calibrated
  probability forecasts from ensemble model output for cloud cover specifically?
  - What is the practical accuracy horizon for different photography-relevant
  variables? At what forecast lead time does cloud cover, precipitation probability,
  visibility, and wind become unreliable enough that the brief should caveat heavily?
  - Are there post-processing/bias-correction techniques (MOS, EMOS, Bayesian model
  averaging) applicable to Open-Meteo ensemble output that could improve the scoring
  accuracy?

  4. Competitive Landscape & User Needs

  - What are the most-used tools by landscape and astrophotographers for weather
  assessment? Analyse Clear Outside, Windy, PhotoPills, The Photographer's Ephemeris,
  Astrospheric, MeteoBlue seeing forecasts, and any niche photography weather tools.
  What do they do well? What do photographers consistently complain about?
  - What do professional landscape photographers say they actually want from a weather
  briefing tool? Are there interviews, blog posts, YouTube videos, or forum discussions
   (e.g., Nature Photographers Network, CloudyNights for astro) where photographers
  describe their decision-making process for whether to go out shooting?
  - How do photographers in the UK and Northern Europe specifically approach weather
  planning? What regional forecast quirks (maritime climate, orographic effects,
  haar/sea fog, Scottish Highlands microclimate) matter most?

  5. Delivery & Engagement

  - What research exists on optimal email digest design for actionable daily briefings?
   Specifically: what information density, visual hierarchy, and progressive disclosure
   patterns lead to highest engagement and decision-making utility?
  - How do the best "should I go?" decision-support tools across domains (surf
  forecasts like Magic Seaweed, ski condition reports, sailing weather) present scored
  conditions and confidence levels? What UX patterns translate well to photography
  conditions?
  - What is the current state of Telegram bot UX for weather/conditions briefings? Are
  there examples of Telegram bots that handle rich forecast data well with inline
  keyboards, scheduled messages, or interactive threshold alerts?

  6. AI Editorial Quality

  - What are the best prompting strategies for generating context-aware, non-repetitive
   natural language weather narratives from structured data? How do weather narrative
  generation systems (e.g., Automated Insights, Arria NLG, or research systems) handle
  the problem of briefings becoming formulaic over time?
  - What validation techniques exist for checking that AI-generated text is factually
  consistent with the source data it's summarising? My system does basic consistency
  checks — what more sophisticated approaches are there?
  - How can I generate creative photography composition suggestions that are genuinely
  informed by the specific atmospheric conditions rather than generic? Are there
  resources mapping weather conditions to specific photographic techniques and
  compositions?

  7. Technical Architecture & Scale

  - If I wanted to move from single-location to multi-location (e.g., "best 5 spots
  within 90 minutes' drive"), what spatial indexing and batch-scoring approaches work
  well for comparing photography conditions across a region?
  - What are the rate limits and fair-use policies for Open-Meteo's free API, and what
  caching/batching strategies are recommended for a system that might score dozens of
  locations per run?
  - Are there emerging open weather data sources (beyond Open-Meteo) that provide
  higher-resolution or more specialised data relevant to photography (e.g.,
  satellite-derived cloud nowcasting, high-resolution visibility models, real-time
  aerosol data)?

  ---
  For each area, I'm looking for: specific data sources, quantitative thresholds, named
   tools/services to study, academic papers or practitioner resources, and concrete
  implementation ideas with trade-offs. Prioritise actionable findings over general
  overviews.

✻ Baked for 2m 58s

❯ Ok research done, in the context of my code, what questions shall I ask the research 
 - that will help us add to or finesse existing connectors?                            

⏺ Let me look at the actual connector/adapter code and the data flows to understand
  exactly what's coming in, how it's being transformed, and where the gaps are.

  Searched for 4 patterns, read 11 files (ctrl+o to expand)

⏺ Now let me look at the scoring evaluators and the capabilities/types to understand
  what signals are consumed vs available but unused.

  Read 9 files (ctrl+o to expand)

⏺ Now let me look at the types that define what features exist and the editorial prompt
   to see what's actually being consumed.

  Searched for 4 patterns, read 6 files (ctrl+o to expand)

⏺ Now let me check what's in the n8n workflow skeleton to understand the actual HTTP
  connector topology.

  Searched for 2 patterns, read 6 files (ctrl+o to expand)

⏺ Now I have a complete picture. Here are the questions to ask your research, mapped
  directly to concrete gaps and opportunities in your code:

  ---
  Questions for the Research — Organised by Connector Gap

  A. Declared feature slots with no data feed

  Your DerivedHourFeatures type declares fields that evaluators consume but that have
  no dedicated connector or are proxy-only. These are the highest-value targets.

  1. Seeing score — replacing the proxy
  ▎ The astro evaluator consumes seeingScore (0–100), currently derived from a
  CAPE/wind-shear/BLH proxy in derive-hour-features.ts. The research should have found
  services like Meteoblue's seeing forecast or Clear Outside's transparency/seeing
  model.
  ▎ - What specific API endpoints exist that return a seeing or scintillation estimate
  suitable for a UK location, and what are their free-tier rate limits?
  ▎ - What input variables do these services use that I'm not already ingesting? If I
  can't get an external feed, which additional Open-Meteo fields would improve my proxy
   beyond CAPE + gustiness + BLH?

  2. Surface wetness — feeding the urban evaluator
  ▎ surfaceWetnessScore is consumed by the urban evaluator (urban.ts:17,24-26) for
  wet-street reflections, but falls back to precip probability. No connector provides
  actual surface state.
  ▎ - Is there a publicly available recent-precipitation or surface-wetness product 
  (e.g., derived from radar accumulation, soil moisture satellite data, or Open-Meteo's
   soil moisture fields) that would be more accurate than "precip prob > 30%"?
  ▎ - What's the decay model — after rain stops, how long do urban surfaces stay
  photographically reflective? Is there a simple time-since-last-rain × temperature
  formula that photographers or road-weather services use?

  3. Lightning risk — where does it actually come from?
  ▎ lightningRisk is consumed by both storm (storm.ts:22,28) and wildlife
  (wildlife.ts:16,38) evaluators. It's declared as optional in DerivedHourFeatures.
  ▎ - Does Open-Meteo expose a lightning probability or CAPE-derived convective product
   beyond raw CAPE that I could use? What about Blitzortung or other free lightning
  APIs?
  ▎ - What CAPE + shear + precipitable water thresholds should I use to derive a
  credible UK-specific lightning probability if I have to keep computing it myself?

  4. Marine data — feeding the empty seascape session
  ▎ tideState, swellHeightM, swellPeriodS are declared in features, and seascape is a
  declared SessionId with no evaluator. The marine capability exists but has no
  connector.
  ▎ - What free APIs provide UK tide times and swell data? (Admiralty API, Open-Meteo
  Marine, Stormglass free tier?) What are their rate limits and coverage?
  ▎ - What swell height / period / tide-state combinations do seascape photographers in
   the UK consider optimal? What wind direction relative to the coast matters?

  5. Hydrology — feeding the empty waterfall session
  ▎ hydrology is a declared capability with no connector. waterfall is a declared
  SessionId with no evaluator.
  ▎ - Does the Environment Agency real-time flood monitoring API (or Scottish
  equivalent) provide river level data usable as a waterfall flow-rate proxy? What's
  the API format and freshness?
  ▎ - What rainfall accumulation window (24h? 48h? 72h?) best predicts "waterfall is
  running well but not dangerously" for UK falls? Is recent-precip-sum from Open-Meteo
  sufficient, or do I need catchment-specific gauges?

  6. Nowcast / radar — feeding the nowcast capability
  ▎ nowcast is a declared capability with no connector. Storm and mist sessions would
  benefit from near-term radar data.
  ▎ - Is there a free radar nowcast API covering the UK (Met Office DataPoint radar,
  RainViewer, Open-Meteo's radar product) that provides 1–3 hour precipitation
  forecasts at reasonable resolution?
  ▎ - How would a nowcast layer interact with the existing hourly forecast scoring? 
  Should it override, blend, or gate the forecast-model-based score when within the
  nowcast horizon (typically 0–2h)?

  B. Existing connectors that could be enriched

  7. Open-Meteo weather — are we leaving fields on the table?
  ▎ The weather connector ingests cloud layers, visibility, humidity, dew point, wind,
  precipitation, CAPE, VPD, BLH, and total column water vapour. But Open-Meteo also
  exposes:
  ▎ - Shortwave radiation, direct/diffuse radiation components — would these improve
  the golden-hour drama score or give a more physics-based "light quality" metric vs
  the current heuristic?
  ▎ - Soil temperature / freezing level height — useful for frost-on-foreground
  predictions (January/February seasonal context mentions this but nothing scores it)?
  ▎ - Snow depth — already fetched for alt locations (prepare-alt-locations.ts:59) but
  not for the home location. Should the home weather connector add it?

  8. Ensemble connector — beyond cloud-cover spread
  ▎ Ensemble confidence currently uses only cloud-cover stddev (confidence.ts:22-28,
  thresholds: 12/25).
  ▎ - Should I also track ensemble spread for visibility and precipitation? The
  research should indicate whether cloud-cover spread alone is a sufficient proxy for
  "forecast reliability" or if multi-variable ensemble analysis gives meaningfully
  better confidence.
  ▎ - Are there calibration or bias-correction techniques (MOS, EMOS, BMA) that could
  be applied to the raw ensemble output to improve the confidence estimate? How complex
   are they to implement vs the improvement?

  9. AuroraWatch UK — is the XML feed the best option?
  ▎ The aurora connector parses AuroraWatch UK XML and NASA DONKI CME JSON, fusing them
   into an AuroraSignal.
  ▎ - Does AuroraWatch UK have a JSON endpoint that would eliminate the XML parsing? Is
   the Lancaster University magnetometer data available more directly?
  ▎ - Are there other free Kp forecast sources (NOAA SWPC 3-day forecast, GFZ Potsdam)
  that would give a better 24–72h Kp prediction than the DONKI CME arrival-time
  estimate? The current system only gets Kp from ENLIL model runs on CME events — it
  has no general Kp forecast for non-CME geomagnetic activity.

  10. METAR — is it pulling its weight?
  ▎ The METAR adapter (wrap-metar.adapter.ts) passes raw METAR text through. It feeds
  metar-note.ts in daily scoring.
  ▎ - What specific METAR elements (present weather codes, runway visual range, cloud
  base heights in feet) would be most valuable to extract and feed into the hourly
  feature set? Currently it seems to only generate a text note, not structured
  features.
  ▎ - Should METAR observations be used as a calibration signal — comparing the latest
  observation against the model forecast to flag when the model is drifting?

  C. New connectors with no existing footprint

  11. Satellite cloud imagery / nowcast
  ▎ - Is there a free satellite-derived cloud product (EUMETSAT, Sat24, or similar)
  that provides current cloud-cover observation at the location level? This could
  validate/override the model forecast for the next 1–3 hours.

  12. Light pollution — dynamic feed
  ▎ lightPollutionBortle is hardcoded (Bortle 7 for home, static per alt location in
  site-darkness.ts).
  ▎ - Is there an API or dataset (lightpollutionmap.info, VIIRS nighttime satellite
  data) that could provide location-specific Bortle estimates at query time, or is the
  static approach already the best available for this?

  13. Sunset colour prediction
  ▎ The sunset-hue connector already exists, but:
  ▎ - What atmospheric science findings would let me build a more physics-based "sunset
   vibrancy" prediction from the existing Open-Meteo data (aerosol optical depth,
  humidity profile, cloud altitude distribution) — reducing dependence on the external
  sunset-hue API?
  ▎ - What is the relationship between aerosol optical depth values (the 0.08–0.18
  sweet-spot in golden-hour evaluator, line 22) and actual sunset colour outcomes? Is
  that sweet-spot range empirically validated or should it shift based on research
  findings?

  14. Pollen / seasonal phenology
  ▎ The seasonal context (seasonal-context.ts) is a static month-by-month lookup.
  ▎ - Are there APIs for real-time phenology (bluebell tracking, heather bloom status,
  autumn colour progression) that could make the "what to photograph this week" advice
  dynamic rather than calendar-based?

  ---
  D. Architecture questions for the research

  15. Multi-location scaling
  ▎ Alt locations are currently a hardcoded list of 8 sites
  (prepare-alt-locations.ts:43-52), each getting a separate Open-Meteo call.
  ▎ - What are Open-Meteo's actual rate limits and batch capabilities? Can I score 20+
  locations in a single call or do I need to stay at the current 8?
  ▎ - For a "best within 90 minutes" feature, does the research suggest any spatial
  indexing approach, or is brute-force scoring of a pre-curated list the standard
  approach in similar tools?

  16. Confidence communication
  ▎ The system uses simple high/medium/low thresholds on ensemble stddev.
  ▎ - What do the best photography weather tools (Clear Outside, Astrospheric) do to
  communicate confidence that my system doesn't? Do any of them use probabilistic
  language ("70% chance the cloud clears by 9pm") vs categorical labels?

  ---
  These questions are ordered so that A (1–6) targets the biggest bang — filling
  declared-but-empty slots in your type system. B (7–10) extracts more from connectors
  you already have. C (11–14) explores genuinely new data sources. D (15–16) addresses
  architecture/UX. Each question references the specific file and line where the gap
  lives in your code.

✻ Worked for 2m 45s

❯ Ok i've done the resarch now, in notebook llm.  I can now ask the research itself    
some questions to help us develop the code                                             

⏺ Good — the research is in the bank. Now you want to interrogate it in a way that
  gives you code-ready answers, not more background. Here are the questions to put to
  NotebookLM, grouped by what you'd actually be building:

  ---
  Filling empty feature slots

  1. Seeing score replacement
  ▎ Based on the research, what is the single most accessible free API for astronomical
   seeing forecasts covering the UK? Give me: the exact endpoint URL pattern, what
  parameters it accepts (lat/lon/time), what fields it returns, and what the update
  frequency is. If no free API exists, what specific formula — using variables I
  already have (CAPE in J/kg, wind gusts in kph, boundary-layer height in metres,
  humidity %) — gives the best proxy for seeing on a 0–100 scale?

  2. Surface wetness model
  ▎ What simple model can I use to estimate how "photographically wet" an urban surface
   is, using only: precipitation amount in the last 1–6 hours (mm), current temperature
   (°C), and wind speed (kph)? I need a function that returns 0–100 where 100 is
  "gleaming wet streets." What's the drying half-life in minutes at 10°C vs 20°C? Does
  humidity matter or is it negligible compared to recent rain?

  3. Lightning risk derivation
  ▎ Give me a concrete formula or lookup table to derive a 0–100 lightning risk score
  from: CAPE (J/kg), vertical wind shear (kts), precipitable water (mm), and
  precipitation probability (%). Specifically for UK/Northern Europe mid-latitude
  conditions, not tropical. What are the threshold bands — e.g., CAPE below X means
  lightning risk is essentially zero regardless of other factors?

  4. Tide and swell for seascape scoring
  ▎ Which free UK tide API gives me tide times and heights in JSON for a given lat/lon?
   What's the request format and rate limit? For swell, does Open-Meteo Marine cover
  the UK coast — what fields does it return and at what resolution? For a seascape
  photography evaluator, what are the ideal swell height and period ranges, and what
  tide states (incoming mid-tide is often cited) are considered best?

  5. River levels for waterfall scoring
  ▎ Does the Environment Agency real-time flood monitoring API return river levels for
  specific gauge stations in JSON? What's the URL pattern? For the Yorkshire Dales
  locations in my alt-locations list (Malham, Ribblehead area), which gauge stations
  would be closest proxies? What river level percentile (relative to typical range)
  indicates "waterfall is running impressively but paths are safe" vs "dangerously
  flooded"?

  6. Radar nowcast
  ▎ What's the simplest free UK radar/nowcast API that returns precipitation intensity
  at a point location for the next 1–2 hours? What format does it return — a time
  series of intensity values, or a single probability? How should I blend a nowcast
  signal with a model forecast: should the nowcast fully override the model within its
  horizon, or should I weight them (e.g., 80/20 nowcast/model at T+30min, 50/50 at
  T+90min)?

  ---
  Enriching existing connectors

  7. Open-Meteo fields I'm not using
  ▎ Which Open-Meteo hourly fields that I'm NOT currently fetching would have the most
  impact on photography scoring? Specifically: does direct_radiation or
  diffuse_radiation give me a better golden-hour light-quality metric than my current
  drama/crepuscular heuristics? Would freezing_level_height or soil_temperature_0cm let
   me predict frost-on-foreground conditions, and what threshold values indicate
  visible frost?

  8. Multi-variable ensemble spread
  ▎ Does the research support tracking ensemble spread for visibility and precipitation
   in addition to cloud cover? If so, what's the right way to combine multi-variable
  spread into a single confidence score — simple average of normalised stddevs, or is
  there a weighted approach where cloud-cover spread matters more than visibility
  spread for photography?

  9. Better Kp forecasting
  ▎ Beyond the NASA DONKI CME feed, what free Kp index forecast API gives me a 1–3 day
  ahead Kp prediction for non-CME geomagnetic activity? NOAA SWPC's 3-day forecast is
  the obvious candidate — what's the exact endpoint, what format does it return, and
  how do I extract the estimated Kp per 3-hour window?

  10. METAR value extraction
  ▎ What are the 3–5 most photographically useful fields I should be parsing out of raw
   METAR strings and feeding into hourly features? I'm thinking: present weather codes
  (fog/mist/haze distinction), cloud base height (low base = dramatic, high base = less
   interesting), and observed visibility vs forecast visibility delta. For each, what's
   the parsing approach — regex on the raw string, or is there a standard METAR parsing
   library for TypeScript/JavaScript?

  ---
  New connector viability

  11. Satellite-derived cloud observation
  ▎ Is there a free API that gives me actual observed cloud cover at a UK lat/lon right
   now (not forecast)? If so, what's the latency — how many minutes old is the
  observation? The use case is: if the model says 80% cloud but the satellite shows
  30%, I want to flag "clearing faster than forecast" in the next 1–2 hour scores.

  12. Sunset colour physics
  ▎ From the atmospheric optics research, what's the quantitative relationship between
  aerosol optical depth and sunset colour vibrancy? My golden-hour evaluator uses a
  sweet-spot of AOD 0.08–0.18 (golden-hour.ts:22). Does the research validate this
  range, narrow it, widen it, or suggest it should vary by season or humidity? Is there
   a better "sunset vibrancy predictor" formula using AOD + cloud-altitude distribution
   + humidity that I could implement as a derived feature?

  13. Real-time phenology
  ▎ Did the research find any API or data source for real-time phenology events in
  Northern England — bluebell status, heather bloom, autumn colour? If not, is there a
  temperature-accumulation model (growing degree days) that I could compute from the
  forecast data I already have to make my seasonal context dynamic rather than a static
   monthly lookup?

  ---
  Scoring calibration

  14. Golden-hour cloud sweet spot
  ▎ My golden-hour evaluator uses a bell curve centred at 50% cloud cover with width 22
   (golden-hour.ts:20). Does the research support this as the optimal cloud coverage
  for dramatic sunsets, or does the evidence point to a different centre/width? Do the
  best sunset photos correlate more with cloud altitude distribution (high cirrus vs
  low stratus) than total coverage percentage?

  15. Astro moon-washout model
  ▎ My astro evaluator uses a 5-band stepped altitude model for moon brightness based
  on Krisciunas-Schaefer (astro.ts:42-52). Did the research find the actual K-S model
  parameters? Are my altitude bands and extinction factors approximately right, or
  should the curve shape be different? At what moon illumination percentage do
  experienced astrophotographers actually pack up — is my 25% threshold for "moonlight
  starts mattering" (astro.ts:53) correct?

  16. Mist formation thresholds
  ▎ My mist evaluator gates on dew-point spread ≤ 2.5°C (mist.ts:24). Does the research
   confirm this as the right threshold for visible mist/fog formation, or should it be
  tighter (≤ 1.5°C) or wider? What boundary-layer height threshold distinguishes
  "valley fog that stays photogenic" from "fog that lifts and dissipates" — my system
  uses BLH in the score but without a clear cutoff.

  ---
  Each of these is phrased to extract a specific number, formula, endpoint, or
  threshold rather than a general explanation. That's what you need to turn research
  into code.

✻ Cooked for 55s

❯ I put the output in here                                                             
/Users/chrisdearnley/Documents/vscode/aperture/docs/research/1.md                      
/Users/chrisdearnley/Documents/vscode/aperture/docs/research/2.md                      
/Users/chrisdearnley/Documents/vscode/aperture/docs/research/3.md is it useful, any    
actionable plans to be made from it?                                                   

  Read 3 files (ctrl+o to expand)

⏺ Good research — uneven depth but several things are directly actionable. Here's my
  honest assessment:

  ---
  Verdict: 5 things you can build now, 4 need a second pass, 7 were dead ends

  Tier 1 — Build now (research gave you what you need)

  1. Add lightning_potential from Open-Meteo
  The research revealed Open-Meteo exposes a native lightning_potential field at
  15-minute intervals. This is a direct drop-in — add it to the weather fetch URL, pipe
   it into DerivedHourFeatures.lightningRisk, and delete whatever proxy you're
  currently using. Also apply the CAPE < 500 J/kg hard floor (risk = 0 below that).
  Single connector change + one feature derivation update.

  2. Widen the AOD sweet spot + add humidity gate to golden-hour
  Research says your 0.08–0.18 range in golden-hour.ts:22 should be 0.1–0.25. And
  you're missing a humidity penalty entirely — RH > 70% causes aerosol swelling that
  kills colour. This is a tweak to two lines in the evaluator plus adding one new
  penalty term gated on humidityPct > 70.

  3. Add direct_radiation / diffuse_radiation + soil_temperature_0cm to the weather
  fetch
  These are existing Open-Meteo fields you're not fetching. Diffuse-to-direct ratio is
  the actual physics behind "soft light quality" that your wildlife and golden-hour
  evaluators currently approximate with cloud heuristics. And soil_temperature_0cm <= 0
   gives you a proper frost-on-foreground signal for the seasonal context. Three new
  fields in the weather URL, three new slots in the feature type, then wire into
  evaluators.

  4. Make ensemble confidence session-aware
  Research says your uniform stddev thresholds (12/25 in confidence.ts:23) are wrong in
   principle — astro should be risk-intolerant (hard cap on score when cloud spread is
  high), storm should treat high variance as opportunity, mist should have separate
  timing confidence. Your confidenceFromSpread in shared.ts:69-80 already takes
  per-session cutoffs — you just need different threshold pairs per session instead of
  the current generic values.

  5. Upgrade cloud-altitude weighting in golden-hour
  Research strongly confirms: high/mid clouds produce colour, low clouds block it. You
  already have highCloudTranslucencyScore and lowCloudBlockingScore in the evaluator —
  but their weights are modest (0.08 bonus, 0.16 penalty). The research says altitude
  distribution matters more than total coverage. Increase these weights and potentially
   reduce the cloudCanvas bell-curve weight from 0.15 to 0.10.

  ---
  Tier 2 — Actionable concept, needs a focused follow-up lookup

  6. Satellite cloud observation (model-vs-reality check)
  Research identified Open-Meteo Satellite Radiation API — compare shortwave_radiation
  vs shortwave_radiation_clear_sky to detect "clearing faster than forecast." The
  concept is solid and the data source exists, but you need to check the actual API
  docs for: endpoint URL, field availability for UK lat/lons, and the 20–30 min latency
   on MTG vs 2h on MSG. One quick API test will tell you if this is viable.

  7. METAR structured parsing
  Research gave you the 4 fields to extract (wx codes FG/BR/HZ/FU, visibility,
  temp/dewpoint, cloud base height) but no parsing library. Search npm for
  metar-taf-parser or metar-decoder — there are a few. If one returns structured JS
  objects, this becomes a quick win: parse METAR → feed observed visibility delta, wx
  type, and cloud base into features. If not, the wx codes are simple regex
  (/\b(FG|BR|HZ|FU|RA|SN)\b/).

  8. Open-Meteo Marine for seascape
  Research confirmed wave_height, wave_direction, wave_period are available for UK
  coast. But it didn't give you the photography-specific ideal ranges. Ask a
  surf/seascape photography forum or check coastal photography guides for: ideal swell
  height (likely 0.5–2m), ideal period (likely 8–14s), and tide state preference. Once
  you have those thresholds, the connector + evaluator is straightforward — it mirrors
  the alt-locations pattern.

  9. NOAA SWPC Kp forecast
  Research confirmed the need but didn't have the endpoint. This is a 5-minute lookup:
  https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json — it
  returns 3-hourly Kp estimates for 3 days ahead. Would fill the gap where your aurora
  system currently only has Kp from CME events (DONKI) and has no general geomagnetic
  forecast.

  ---
  Tier 3 — Research didn't deliver (park or re-research)

  These came back empty or too vague to act on:

  - Seeing API details — 7Timer! mentioned but no usable endpoint/format. And the key
  insight is that your proxy uses the wrong variables (surface CAPE/BLH) when seeing is
   driven by upper-level jet stream winds at 200–300 hPa, which Open-Meteo doesn't
  expose. Park this unless you find a direct seeing feed.
  - Surface wetness formula — Concept confirmed, no formula. You'd need to build your
  own drying model. Low priority since the urban evaluator's precip-probability
  fallback is decent.
  - Tide API — Nothing found. UK Admiralty API (UKHO) exists but is paid.
  Worldtides.info has a free tier. Needs independent lookup.
  - River levels / waterfall — Complete blank. Environment Agency API exists
  (environment.data.gov.uk/flood-monitoring) but research didn't cover it.
  - Radar nowcast API — Concept validated, no specific endpoint. Met Office DataHub or
  RainViewer would need independent evaluation.
  - Mist BLH cutoff — Dew-point deficit confirmed as top predictor but couldn't resolve
   2.5°C vs 1.5°C, and no BLH threshold given. Your current values are defensible;
  leave them.
  - Phenology — PEP725 exists but is a research database, not a real-time API. GDD
  model from existing forecast data is interesting but complex for low payoff.

  ---
  Suggested build order

  ┌──────────┬───────────────────────────┬────────┬────────────────────────────────┐
  │ Priority │          Change           │ Effort │         Files touched          │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │          │ Add lightning_potential   │        │ weather URL,                   │
  │ 1        │ to weather fetch          │ Small  │ derive-hour-features,          │
  │          │                           │        │ storm/wildlife evaluators      │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │ 2        │ Widen AOD sweet spot +    │ Tiny   │ golden-hour.ts (2–3 lines)     │
  │          │ add RH>70% penalty        │        │                                │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │          │ Add radiation + soil temp │        │ weather URL, feature types,    │
  │ 3        │  fields                   │ Small  │ golden-hour/wildlife           │
  │          │                           │        │ evaluators                     │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │ 4        │ Session-aware ensemble    │ Medium │ confidence.ts, shared.ts, each │
  │          │ confidence                │        │  evaluator's confidence call   │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │ 5        │ Increase cloud-altitude   │ Tiny   │ golden-hour.ts (weight         │
  │          │ weights in golden-hour    │        │ rebalance)                     │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │ 6        │ NOAA SWPC Kp forecast     │ Small  │ new adapter, fuse into aurora  │
  │          │ connector                 │        │ signal                         │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │ 7        │ METAR structured parsing  │ Medium │ find/add library,              │
  │          │                           │        │ metar-note.ts, feature wiring  │
  ├──────────┼───────────────────────────┼────────┼────────────────────────────────┤
  │ 8        │ Satellite radiation       │ Medium │ new connector, blending logic  │
  │          │ reality-check             │        │ in score-hour                  │
  └──────────┴───────────────────────────┴────────┴────────────────────────────────┘

  Want me to start on any of these?

✻ Worked for 1m 9s

❯ When you say uneven depth - do you want to give a research prompt to fill in some    
blanks?                                                                                

⏺ Yes — here's a surgical follow-up prompt that targets only the blanks. Everything the
   first round already answered well is excluded.

  ---
  Follow-up Research Prompt

  Context from round 1: I've already confirmed the following from prior research and
  don't need them revisited: Open-Meteo has lightning_potential (will use it), AOD
  sweet spot is 0.1–0.25, golden-hour cloud centre at 50% is correct, moon washout 25%
  threshold is validated, ensemble confidence should be session-specific,
  direct_radiation/diffuse_radiation/soil_temperature_0cm are available from
  Open-Meteo. Skip all of these.

  I need specific, concrete answers on these gaps:

  ---
  1. 7Timer! Astronomical Seeing API — exact details

  The first round named 7Timer! as the best free seeing forecast but provided no
  implementation details. I need:
  - The exact API endpoint URL format (I believe it's something like
  http://www.7timer.info/bin/api.pl?lon=X&lat=Y&product=astro&output=json — confirm or
  correct)
  - What fields come back in the JSON response? Specifically: what is the seeing field
  called, what scale/bins does it use, and what is the transparency field called?
  - What is the forecast time resolution (3-hourly? 6-hourly?) and how many hours ahead
   does it cover?
  - How often is the model updated?
  - Is there any rate limiting or fair-use policy?

  If 7Timer! turns out to be unreliable or poorly maintained, is there any other free
  seeing/transparency API that covers the UK?

  ---
  2. Surface wetness — empirical pavement drying model

  Round 1 confirmed the concept but gave no formula. I need to build a function
  estimateSurfaceWetness(recentPrecipMm, hoursSinceRain, temperatureC, windKph) →
  0–100. Specifically:
  - What is the empirical drying rate for asphalt/paved urban surfaces after rain? Road
   weather research (RWIS systems, Scandinavian road-surface models like RoadSurf or
  METRo) must have published drying curves — what do they say?
  - Is an exponential decay model appropriate? If so, what's the time constant (or
  half-life) as a function of temperature and wind?
  - At what precipitation accumulation (mm in the last hour) does a surface go from
  "damp" to "standing water with reflections"?
  - Does evaporation rate scale linearly with temperature, or is there a threshold
  effect?

  I don't need a perfect model — I need a defensible approximation with real numbers.

  ---
  3. UK tide data — free API options

  Round 1 returned nothing. I need:
  - UKHO Admiralty Tidal API: Is there a free tier? What's the endpoint format, and
  does it return tide times + heights in JSON for a given station ID?
  - Worldtides.info: Does their free tier cover UK stations? What are the rate limits?
  What's the request/response format?
  - Any other option (e.g., tidesandcurrents equivalents for the UK, or tide prediction
   libraries that compute from harmonic constants offline)?
  - For the North Sea and Irish Sea coasts relevant to Northern England photographers —
   which approach gives the best coverage?

  ---
  4. Environment Agency flood monitoring API — river levels for waterfall proxy

  Round 1 was a complete blank. The API exists at
  environment.data.gov.uk/flood-monitoring. I need:
  - What is the URL pattern for querying a specific gauging station's recent readings?
  - What does the JSON response look like — specifically, what fields give me the
  current level, the typical range, and the percentile?
  - For the Yorkshire Dales area (Wharfedale, Ribblesdale, Airedale), what are the
  nearest gauging station IDs that would proxy for waterfall flow at Bolton Abbey,
  Malham, and Ribblehead?
  - Is there a "measures" or "stations" discovery endpoint I can use to find stations
  near a lat/lon?
  - What reading cadence do the gauges report at (15-min? hourly?) and is there any
  rate limiting?

  ---
  5. UK radar nowcast — specific free APIs

  Round 1 validated the concept but named no endpoint. I need:
  - Met Office DataHub: Does the free "Site Specific" or "Atmospheric" dataset include
  radar-derived precipitation nowcast? What's the registration process and rate limit?
  - RainViewer API: Does it cover the UK? What's the endpoint format for getting
  precipitation intensity at a point lat/lon for the next 1–2 hours? Is it truly free?
  - Open-Meteo minutely_15 precipitation: Does Open-Meteo offer a sub-hourly
  precipitation forecast that could serve as a nowcast proxy? If so, what fields and
  what forecast horizon?
  - For whichever API is most viable: what does the response look like, and what's the
  practical latency (how old is the most recent radar scan)?

  ---
  6. NOAA SWPC Kp index forecast — endpoint and format

  Round 1 confirmed the need but had no details. I need:
  - The exact endpoint URL for the NOAA SWPC planetary K-index 3-day forecast (I
  believe it's
  https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json —
  confirm or correct)
  - What does the JSON response structure look like? Is it an array of [timestamp,
  kp_value] pairs, or something else?
  - What time resolution are the forecasts (3-hourly Kp bins)?
  - Is there any authentication or rate limiting?
  - Is there also a SWPC endpoint for the estimated Kp (observed/nowcast) vs the
  forecast Kp, so I can compare prediction vs reality?

  ---
  7. Mist formation — resolving the dew-point threshold and BLH cutoff

  Round 1 confirmed dew-point deficit is the strongest predictor but couldn't resolve
  whether my 2.5°C gate should be tighter. I need:
  - What do operational fog forecasting models (like the UK Met Office's NAME model, or
   ECMWF fog diagnostics) use as their dew-point depression threshold for radiation fog
   onset? Is it 1°C, 2°C, or 2.5°C?
  - The Fog Stability Index (FSI) was mentioned with a threshold of < 31. What are the
  input variables for FSI and can I compute it from Open-Meteo fields (wind speed,
  cloud cover, dew-point depression, soil temperature)?
  - For valley fog persistence specifically (relevant to Yorkshire Dales photography):
  at what boundary-layer height does trapped cold-air pooling typically break up? Is
  there a BLH threshold (e.g., < 200m = fog persists, > 500m = fog lifts) used in
  operational forecasting?

  ---
  8. Seascape photography — ideal conditions from practitioners

  Round 1 confirmed Open-Meteo Marine has wave data but had no photography-specific
  thresholds. I need:
  - What swell height range do UK coastal/seascape photographers consider ideal? (My
  assumption: 0.5–2.0m for "dramatic but manageable")
  - What swell period makes for the best long-exposure wave patterns? (Short choppy vs
  long rolling)
  - Is incoming mid-tide actually the preferred state, and why? What about the last
  hour before high tide for rock-pool foregrounds?
  - What wind direction relative to the coast is best — onshore for spray and drama, or
   offshore for cleaner wave faces?
  - Any named references: books, blogs, or YouTube channels by UK seascape
  photographers (e.g., Adam Burton, Mark Bauer, Francesco Sheridan) that discuss their
  weather planning process?

  ---
  9. METAR parsing in JavaScript/TypeScript

  Round 1 identified the fields to extract but no library. I need:
  - Is there a maintained npm package for METAR parsing? Candidates I'm aware of:
  metar-taf-parser, metar-decoder, metar-parser. Which is most actively maintained,
  handles UK METAR format (including present weather codes, cloud layers with heights,
  and visibility in metres), and returns structured objects?
  - If no library is suitable, what are the exact regex patterns for extracting: (a)
  present weather codes (FG, BR, HZ, FU, RA, SN, TS), (b) visibility in metres, (c)
  cloud layers with base height (e.g., FEW012, BKN004), and (d) temperature/dewpoint
  pair?

  ---
  For every answer, I need: specific URLs, field names, threshold numbers, or
  code-ready formulas. General descriptions of what "could be done" are not useful — I
  already know what I want to build. I need the implementation details.

✻ Cogitated for 1m 1s

❯ For the things you already have enough info to implement can you add each to my      
issues tagged as enhancements? https://github.com/garyneville/aperture/issues\         
\                                                                                      
Can you first check over any existing enhancements, and if an item is already          
captured, add to it via the dicussion of it.  If any seem outdated or irrelevant, or   
low value return on investment - suggest a cull list at the end?                       

⏺ Bash(gh issue list --repo garyneville/aperture --label enhancement --state open
      --limit 50 --json number,title,body,labels,comments)
  ⎿  [{"body":"## Summary\nAdd a first-class `waterfall` session evaluator once hy
     drology and wetness capabilities exist, using flow/recent rain context rather
      than generic moisture heuristics alone.\n\n## Grade\n- Complexity: 4/5\n- Im
     … +259 lines (ctrl+o to expand)

⏺ Bash(gh issue list --repo garyneville/aperture --label enhancement --state open
      --limit 50 --json number,title,body,labels,comments | jq '[.[] | {number,
      title}]')
  ⎿  [
       {
         "number": 52,
     … +38 lines (ctrl+o to expand)

⏺ Good — 11 open enhancements. Let me map my research findings against them and then
  act.

  Here's the plan:
  - Comment on 5 existing issues where research adds concrete implementation detail
  - Create 3 new issues for actionable items not captured anywhere
  - Suggest a cull list at the end

  Let me execute:

⏺ Bash(gh issue comment 34 --repo garyneville/aperture --body "$(cat <<'EOF'
      ## Research finding: Open-Meteo `lightning_potential` is a direct drop-in…)
  ⎿  https://github.com/garyneville/aperture/issues/34#issuecomment-4188989241

⏺ Bash(gh issue comment 35 --repo garyneville/aperture --body "$(cat <<'EOF'
      ## Research finding: quick-win AOD recalibration + humidity gate…)
  ⎿  https://github.com/garyneville/aperture/issues/35#issuecomment-4188989460

⏺ Bash(gh issue comment 30 --repo garyneville/aperture --body "$(cat <<'EOF'
      ## Research finding: concrete first steps toward the physics baseline…)
  ⎿  https://github.com/garyneville/aperture/issues/30#issuecomment-4188989807

⏺ Bash(gh issue comment 31 --repo garyneville/aperture --body "$(cat <<'EOF'
      ## Research finding: Open-Meteo Satellite Radiation API as a concrete nowcast
      source…)
  ⎿  https://github.com/garyneville/aperture/issues/31#issuecomment-4188990134

⏺ Bash(gh issue comment 37 --repo garyneville/aperture --body "$(cat <<'EOF'
      ## Research finding: Open-Meteo Marine confirmed for UK coast…)
  ⎿  https://github.com/garyneville/aperture/issues/37#issuecomment-4188990461

⏺ Good — 5 comments posted. Now creating the 3 new issues:

⏺ Bash(gh issue create --repo garyneville/aperture --label enhancement --title "Make
      ensemble confidence session-aware instead of uniform thresholds" --body "$(cat
      <<'…)
  ⎿  https://github.com/garyneville/aperture/issues/219

⏺ Bash(gh issue create --repo garyneville/aperture --label enhancement --title "Parse
      METAR into structured features instead of raw text passthrough" --body "$(cat
      <<'…)
  ⎿  https://github.com/garyneville/aperture/issues/220

⏺ Bash(gh issue create --repo garyneville/aperture --label enhancement --title "Add
      NOAA SWPC Kp forecast for general geomagnetic aurora prediction" --body "$(cat
      <<'E…)
  ⎿  https://github.com/garyneville/aperture/issues/221

⏺ All done. Here's the summary:

  What was done

  Comments added to 5 existing issues:

  ┌───────┬─────────────────────────────────────────────────────────────────────────┐
  │ Issue │                             Research added                              │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #34   │ Open-Meteo lightning_potential as direct drop-in + CAPE < 500 hard      │
  │       │ floor                                                                   │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #35   │ AOD sweet spot widen to 0.1–0.25 + RH > 70% humidity penalty (2–3 line  │
  │       │ change)                                                                 │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #30   │ direct_radiation/diffuse_radiation/soil_temperature_0cm as concrete     │
  │       │ first steps + cloud-altitude weight rebalance                           │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #31   │ Open-Meteo Satellite Radiation API as lightweight nowcast-like reality  │
  │       │ check                                                                   │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #37   │ Open-Meteo Marine fields confirmed for UK coast + hydrology gap flagged │
  └───────┴─────────────────────────────────────────────────────────────────────────┘

  3 new issues created:

  ┌───────┬─────────────────────────────────────────────────────────────────────────┐
  │ Issue │                                  What                                   │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #219  │ Session-aware ensemble confidence (astro risk-intolerant, storm         │
  │       │ volatility-seeking)                                                     │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #220  │ METAR structured parsing (wx codes, visibility, cloud base,             │
  │       │ temp/dewpoint)                                                          │
  ├───────┼─────────────────────────────────────────────────────────────────────────┤
  │ #221  │ NOAA SWPC Kp forecast for non-CME aurora prediction                     │
  └───────┴─────────────────────────────────────────────────────────────────────────┘

  ---
  Suggested cull list

  Issue: #44 — ML calibration loop
  Recommendation: Defer / close as premature
  Reasoning: Complexity 5/5, requires production data that doesn't exist yet. No amount

    of architecture will help until you have labeled outcomes. Reopen when you have 6+
    months of runs with photographer feedback.
  ────────────────────────────────────────
  Issue: #41 — Microclimate / topographic light
  Recommendation: Defer / close as blocked
  Reasoning: Complexity 5/5, and your own comment says the timezone unification must
    happen first. Even after that, 90m DEM terrain modeling is a large surface area for

    uncertain payoff. The azimuth scan already captures the coarsest horizon-blocking
    signal.
  ────────────────────────────────────────
  Issue: #35 — Richer aerosol typing (the full vision)
  Recommendation: Descope to the quick win only
  Reasoning: The full issue asks for speciated aerosols, Angstrom exponent, etc. —
    complexity 5/5. But the research showed the actual high-value change is the AOD
    range tweak + humidity gate, which is 3 lines. The rest (smoke-vs-haze-vs-dust
    discrimination) has diminishing returns unless you're in a wildfire-prone region.
    Consider closing the issue once the quick win lands and reopening only if
  real-world
     briefs show aerosol misclassification.
  ────────────────────────────────────────
  Issue: #52 — Waterfall evaluator
  Recommendation: Keep but acknowledge it's stalled
  Reasoning: Blocked on #37 (hydrology), which the research couldn't fill. The
    Environment Agency API exists but needs someone to manually map gauge stations to
    your alt-locations. Low near-term probability of unblocking.

  The rest (#51 seascape, #45 post-frontal clarity, #43 safety badges, #31 nowcasting,
  #30 physics baseline, #34 storm layers) all have concrete next steps from the
  research and are worth keeping.

✻ Sautéed for 3m 26s

❯ Cull those 4 for me (delete / close) - if close, put a comment explaining why        

⏺ Bash(gh issue close 44 --repo garyneville/aperture --comment "$(cat <<'EOF'
      ## Closing as premature…)
  ⎿  ✓ Closed issue garyneville/aperture#44 (Design a historical calibration loop
     for score tuning and ML-assisted weighting)

⏺ Bash(gh issue close 41 --repo garyneville/aperture --comment "$(cat <<'EOF'
      ## Closing as blocked and low near-term ROI…)
  ⎿  ✓ Closed issue garyneville/aperture#41 (Add microclimate and topographic ligh
     t modeling for effective sunset timing)

⏺ Bash(gh issue close 35 --repo garyneville/aperture --comment "$(cat <<'EOF'
      ## Closing the broad vision — quick win captured elsewhere…)
  ⎿  ✓ Closed issue garyneville/aperture#35 (Add richer aerosol typing and advance
     d clarity metrics)

⏺ Bash(gh issue close 52 --repo garyneville/aperture --comment "$(cat <<'EOF'
      ## Closing as stalled on unresolved dependency…)
  ⎿  ✓ Closed issue garyneville/aperture#52 (Add a waterfall session evaluator aft
     er hydrology capability lands)

⏺ Done. All 4 closed with explanations:

  ┌────────────────┬───────────────────┬──────────────────────────────────────────┐
  │     Issue      │      Action       │                  Reason                  │
  ├────────────────┼───────────────────┼──────────────────────────────────────────┤
  │ #44 ML         │ Closed as         │                                          │
  │ calibration    │ premature         │ No production data to train on yet       │
  │ loop           │                   │                                          │
  ├────────────────┼───────────────────┼──────────────────────────────────────────┤
  │ #41            │                   │ Timezone fix prerequisite + high         │
  │ Topographic    │ Closed as blocked │ complexity / low ROI                     │
  │ light          │                   │                                          │
  ├────────────────┼───────────────────┼──────────────────────────────────────────┤
  │ #35 Aerosol    │ Closed, quick win │ The 3-line AOD/humidity tweak is the     │
  │ typing         │  redirected to    │ real value; full aerosol typing is       │
  │                │ #30               │ overkill for Northern England            │
  ├────────────────┼───────────────────┼──────────────────────────────────────────┤
  │ #52 Waterfall  │ Closed as stalled │ Hydrology dependency has no data source  │
  │ evaluator      │                   │ yet                                      │
  └────────────────┴───────────────────┴──────────────────────────────────────────┘

  Each comment includes a clear "reopen when" condition so nothing is permanently lost.