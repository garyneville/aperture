# Contracts

Public cross-layer contract surface for types shared across app, domain, presenters, and adapters.

## Purpose

This directory contains the **single entry point** for cross-layer types. Import from here rather than from internal implementation paths to ensure loose coupling between layers.

## Usage

```typescript
// Good: Import from contracts
import type { 
  BriefJson, 
  ScoredForecastContext, 
  EditorialDecision 
} from '../contracts/index.js';

// Avoid: Importing from internal paths across layer boundaries
// import type { BriefJson } from '../types/brief.js'; // Don't do this from presenters
```

## Available Contracts

### Brief Types (`brief.ts`)
Payloads, render inputs, window definitions.
- `BriefJson`, `BriefRenderInput`
- `Window`, `DaySummary`, `WindowDisplayPlan`
- `AltLocation`, `CarWash`
- `LongRangeCard`, `DarkSkyAlertCard`

### Scored Forecast (`scored-forecast.ts`)
Runtime context for rendering.
- `ScoredForecastContext`

### Home Location (`home-location.ts`)
Shared home-location configuration shape.
- `HomeLocation`

### Session Score (`session-score.ts`)
Session scoring and alert types.
- `SessionId`, `SessionRecommendationSummary`, `SessionScore`
- `SessionConfidence`, `SessionEvaluator`
- `Alert`, `AlertLevel`, `AlertCategory`

### Editorial (`editorial.ts`)
Editorial resolution types.
- `BriefContext`, `EditorialDecision`, `SpurSuggestion`
- `ResolveEditorialInput`, `ResolveEditorialOutput`
- `EditorialGatewayPayload`, `EditorialGatewayResult`, `EditorialGatewayOutcome`
- `EditorialCandidatePayload`, `EditorialParseResult`

### Run Photo Brief (`run-photo-brief.ts`)
Main use case contracts.
- `EditorialDecision`

### Debug (`debug.ts`)
Debug context and diagnostics types for tracing and observability.

**Slot-role based types (preferred for new code):**
- `DebugPrimaryDiagnostics` — Diagnostics for primary AI provider
- `DebugFallbackDiagnostics` — Diagnostics for fallback AI provider
- `ProviderSlot` — `'primary' | 'fallback'`
- `SelectedProvider` — `ProviderSlot | 'template'`

**Legacy provider-specific types (deprecated):**
- `DebugGeminiDiagnostics` — Alias for `DebugPrimaryDiagnostics`
- `DebugGroqDiagnostics` — Alias for `DebugFallbackDiagnostics`

**Core debug types:**
- `DebugContext`, `DebugPayloadSnapshot`
- `DebugApiCallStatus`
- `DebugRunMetadata`, `DebugScores`, `DebugHourlyScore`, `DebugWindowTrace`
- `DebugAiTrace`, `DebugWeekStandoutTrace`
- `DebugLongRangeCandidate`, `DebugNearbyAlternative`
- `DebugKitAdvisory`, `DebugOutdoorComfort`

## Structure

Each contract module:
1. Re-exports from the canonical source
2. Adds JSDoc documentation
3. Maintains backward compatibility

Internal-only types that aren't shared across layers remain in their respective directories (`src/types/*`, `src/domain/*`, etc.).
