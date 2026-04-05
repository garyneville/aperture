Comments added to 5 existing issues:

  ┌───────┬────────────────────────────────────────────────────────────┐
  │ Issue │                       Research added                       │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #34   │ Open-Meteo lightning_potential as direct drop-in + CAPE <  │
  │       │ 500 hard floor                                             │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #35   │ AOD sweet spot widen to 0.1–0.25 + RH > 70% humidity       │
  │       │ penalty (2–3 line change)                                  │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #30   │ direct_radiation/diffuse_radiation/soil_temperature_0cm as │
  │       │  concrete first steps + cloud-altitude weight rebalance    │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #31   │ Open-Meteo Satellite Radiation API as lightweight          │
  │       │ nowcast-like reality check                                 │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #37   │ Open-Meteo Marine fields confirmed for UK coast +          │
  │       │ hydrology gap flagged                                      │
  └───────┴────────────────────────────────────────────────────────────┘

  3 new issues created:

  ┌───────┬────────────────────────────────────────────────────────────┐
  │ Issue │                            What                            │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #219  │ Session-aware ensemble confidence (astro risk-intolerant,  │
  │       │ storm volatility-seeking)                                  │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #220  │ METAR structured parsing (wx codes, visibility, cloud      │
  │       │ base, temp/dewpoint)                                       │
  ├───────┼────────────────────────────────────────────────────────────┤
  │ #221  │ NOAA SWPC Kp forecast for non-CME aurora prediction        │
  └───────┴────────────────────────────────────────────────────────────┘

  ---
  Suggested cull list

  Issue: #44 — ML calibration loop
  Recommendation: Defer / close as premature
  Reasoning: Complexity 5/5, requires production data that doesn't exist
    yet. No amount of architecture will help until you have labeled
    outcomes. Reopen when you have 6+ months of runs with photographer
    feedback.
  ────────────────────────────────────────
  Issue: #41 — Microclimate / topographic light
  Recommendation: Defer / close as blocked
  Reasoning: Complexity 5/5, and your own comment says the timezone
    unification must happen first. Even after that, 90m DEM terrain
    modeling is a large surface area for uncertain payoff. The azimuth
  scan
     already captures the coarsest horizon-blocking signal.
  ────────────────────────────────────────
  Issue: #35 — Richer aerosol typing (the full vision)
  Recommendation: Descope to the quick win only
  Reasoning: The full issue asks for speciated aerosols, Angstrom
  exponent,
    etc. — complexity 5/5. But the research showed the actual high-value
    change is the AOD range tweak + humidity gate, which is 3 lines. The
    rest (smoke-vs-haze-vs-dust discrimination) has diminishing returns
    unless you're in a wildfire-prone region. Consider closing the issue
    once the quick win lands and reopening only if real-world briefs show
    aerosol misclassification.
  ────────────────────────────────────────
  Issue: #52 — Waterfall evaluator
  Recommendation: Keep but acknowledge it's stalled
  Reasoning: Blocked on #37 (hydrology), which the research couldn't fill.

    The Environment Agency API exists but needs someone to manually map
    gauge stations to your alt-locations. Low near-term probability of
    unblocking.

  The rest (#51 seascape, #45 post-frontal clarity, #43 safety badges, #31
   nowcasting, #30 physics baseline, #34 storm layers) all have concrete
  next steps from the research and are worth keeping.

✻ Crunched for 3m 26s

❯ Cull those 4 for me (delete / close) - if close, put a comment          
explaining why                                                            

⏺ Bash(gh issue close 44 --repo garyneville/aperture --comment "$(cat
      <<'EOF'
      ## Closing as premature…)
  ⎿  ✓ Closed issue garyneville/aperture#44 (Design a historical cali
     bration loop for score tuning and ML-assisted weighting)

⏺ Bash(gh issue close 41 --repo garyneville/aperture --comment "$(cat
      <<'EOF'
      ## Closing as blocked and low near-term ROI…)
  ⎿  ✓ Closed issue garyneville/aperture#41 (Add microclimate and top
     ographic light modeling for effective sunset timing)

⏺ Bash(gh issue close 35 --repo garyneville/aperture --comment "$(cat
      <<'EOF'
      ## Closing the broad vision — quick win captured elsewhere…)
  ⎿  ✓ Closed issue garyneville/aperture#35 (Add richer aerosol typin
     g and advanced clarity metrics)

⏺ Bash(gh issue close 52 --repo garyneville/aperture --comment "$(cat
      <<'EOF'
      ## Closing as stalled on unresolved dependency…)
  ⎿  ✓ Closed issue garyneville/aperture#52 (Add a waterfall session
     evaluator after hydrology capability lands)

⏺ Done. All 4 closed with explanations:

  ┌───────────────┬─────────────────┬─────────────────────────────────┐
  │     Issue     │     Action      │             Reason              │
  ├───────────────┼─────────────────┼─────────────────────────────────┤
  │ #44 ML        │ Closed as       │ No production data to train on  │
  │ calibration   │ premature       │ yet                             │
  │ loop          │                 │                                 │
  ├───────────────┼─────────────────┼─────────────────────────────────┤
  │ #41           │ Closed as       │ Timezone fix prerequisite +     │
  │ Topographic   │ blocked         │ high complexity / low ROI       │
  │ light         │                 │                                 │
  ├───────────────┼─────────────────┼─────────────────────────────────┤
  │               │ Closed, quick   │ The 3-line AOD/humidity tweak   │
  │ #35 Aerosol   │ win redirected  │ is the real value; full aerosol │
  │ typing        │ to #30          │  typing is overkill for         │
  │               │                 │ Northern England                │
  ├───────────────┼─────────────────┼─────────────────────────────────┤
  │ #52 Waterfall │ Closed as       │ Hydrology dependency has no     │
  │  evaluator    │ stalled         │ data source yet                 │
  └───────────────┴─────────────────┴─────────────────────────────────┘

  Each comment includes a clear "reopen when" condition so nothing is