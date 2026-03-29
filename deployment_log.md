# Deployment Log

## 2026-03-29

- [PR #11](https://github.com/garyneville/aperture/pull/11) `extract shared scored context and drop stale home fallbacks`
  Removed the remaining transition-era Leeds/London fallbacks and extracted a shared scored forecast context so standalone, renderer, and adapter code stopped typing through `BuildPromptOutput`.

- [PR #13](https://github.com/garyneville/aperture/pull/13) `add session scoring foundation`
  Added the first session-aware scoring layer with shared capability/session types, initial `golden-hour`, `astro`, and `mist` evaluators, and debug visibility for per-hour session scoring.

- [PR #15](https://github.com/garyneville/aperture/pull/15) `extract derived hour feature seam`
  Moved derived hour feature calculation into a dedicated module and made session scoring consume an explicit feature seam instead of relying on the legacy `ScoredHour` structure.

- [PR #17](https://github.com/garyneville/aperture/pull/17) `add storm session selection helpers`
  Added the initial `storm` evaluator plus helper utilities for selecting the strongest session per hour and across candidate hours.

- [PR #19](https://github.com/garyneville/aperture/pull/19) `propagate convective feature inputs`
  Captured raw hour-level feature inputs during scoring and propagated live convective signals like CAPE into session evaluation.

- [PR #21](https://github.com/garyneville/aperture/pull/21) `model session-specific confidence and volatility`
  Added session-specific uncertainty handling so astro reacts conservatively to ensemble spread while storm treats volatility as a potentially positive signal.

- [PR #23](https://github.com/garyneville/aperture/pull/23) `propagate azimuth risk into session scoring`
  Promoted existing azimuth/light-path scan data into derived features and used it to refine `golden-hour` and `storm` scoring, reasons, and warnings.

- [PR #25](https://github.com/garyneville/aperture/pull/25) `expose session recommendation summary`
  Added a first-class `sessionRecommendation` artifact to core scoring output with a primary recommendation, runner-ups, and per-session best picks.

- [PR #27](https://github.com/garyneville/aperture/pull/27) `propagate session recommendations through shared context`
  Carried `sessionRecommendation` into the shared scored context and structured JSON rendering path so downstream editorial/UI layers can consume it explicitly.

- Related architectural umbrella: [Issue #12](https://github.com/garyneville/aperture/issues/12)
  The follow-on enhancement issues in this session built out the session-aware scoring architecture incrementally without forcing a broad UI rewrite.

- Repo hygiene (no PR)
  Deleted stale local and remote codex/copilot/source-import/backup branches, kept `gh-pages` parked intentionally, removed the temporary `REFACTOR-HANDOFF.md`, and reduced the repo to `main` plus `gh-pages` remotely.
