import type { BuildPromptOutput } from '../build-prompt.js';

export type EditorialProvider = 'groq' | 'gemini';

export interface ForecastLocation {
  name: string;
  lat: number;
  lon: number;
  timezone: string;
  icao?: string;
}

export interface ForecastBundle {
  generatedAt: string;
  location: ForecastLocation;
  providerPayloads: {
    weather: unknown;
    airQuality?: unknown;
    metar?: unknown;
    sunsetHue?: unknown;
    azimuth?: unknown;
    ensemble?: unknown;
    kpForecast?: unknown;
    aurora?: unknown;
    precipProbability?: unknown;
  };
}

export type ScoredForecastContext = Omit<BuildPromptOutput, 'prompt'>;

export interface EditorialRequest {
  prompt: string;
  context: ScoredForecastContext;
}

export interface SpurSuggestion {
  locationName: string;
  region: string;
  driveMins: number;
  tags: string[];
  darkSky: boolean;
  hookLine: string;
  confidence: number;
}

export interface EditorialDecision {
  primaryProvider: EditorialProvider;
  selectedProvider: EditorialProvider | 'template';
  fallbackUsed: boolean;
  aiText: string;
  compositionBullets: string[];
  weekInsight: string;
  spurOfTheMoment?: SpurSuggestion | null;
  rawGroqResponse?: string;
  rawGeminiResponse?: string;
}

export interface RenderedOutputs {
  telegramMsg: string;
  emailHtml: string;
  debugEmailHtml?: string;
  debugEmailSubject?: string;
  siteHtml?: string;
}

export type RunnerStage =
  | 'acquire'
  | 'score'
  | 'buildEditorialRequest'
  | 'resolveEditorial'
  | 'render'
  | 'persist'
  | 'deliver';

export interface StandaloneBriefRun {
  generatedAt: string;
  forecast: ForecastBundle;
  scoredContext: ScoredForecastContext;
  editorialRequest: EditorialRequest;
  editorial: EditorialDecision;
  outputs: RenderedOutputs;
  stageTimingsMs: Partial<Record<RunnerStage, number>>;
}
