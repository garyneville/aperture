import {
  weekStandoutSchemaHint,
  weekStandoutInstructionBlock,
  buildWeekStandoutInstructions,
} from './week-standout.js';

export interface ResponseContractParams {
  homeLocationName: string;
  variant: 'local-window' | 'dont-bother';
  maxWords?: number;
}

export interface StructuredPromptParts {
  systemPrompt: string;
  userPrompt: string;
}

export const EDITORIAL_RESPONSE_SCHEMA_NAME = 'photo_brief_editorial_response';

export function buildLocalWindowResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      editorial: { type: 'string' },
      composition: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: { type: 'string' },
      },
      weekStandout: { type: 'string' },
      spurOfTheMoment: {
        type: 'object',
        properties: {
          locationName: { type: 'string' },
          hookLine: { type: 'string' },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
        },
        required: ['locationName', 'hookLine', 'confidence'],
        additionalProperties: false,
      },
    },
    required: ['editorial', 'composition', 'weekStandout', 'spurOfTheMoment'],
    additionalProperties: false,
  };
}

export function buildDontBotherResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      editorial: { type: 'string' },
      composition: {
        type: 'array',
        maxItems: 0,
        items: { type: 'string' },
      },
      weekStandout: { type: 'string' },
      spurOfTheMoment: {
        type: 'object',
        properties: {
          locationName: { type: 'string' },
          hookLine: { type: 'string' },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
        },
        required: ['locationName', 'hookLine', 'confidence'],
        additionalProperties: false,
      },
    },
    required: ['editorial', 'composition', 'weekStandout', 'spurOfTheMoment'],
    additionalProperties: false,
  };
}

export function buildEditorialResponseContractText(p: ResponseContractParams): string {
  const { homeLocationName, variant, maxWords = 55 } = p;

  // Build the editorial field based on variant
  const editorialField = variant === 'local-window'
    ? '"<2 sentences max 55 words>"'
    : `"<exactly 2 sentences, max ${maxWords} words — sentence 1: why ${homeLocationName} is not worth it today; sentence 2: best nearby alternative if provided>"`;

  // Build the composition field based on variant
  const compositionField = variant === 'local-window'
    ? '["<shot idea 1>","<shot idea 2>"]'
    : '[]';

  return `Respond with ONLY a raw JSON object — no markdown, no code fences:
{"editorial":${editorialField},"composition":${compositionField},"weekStandout":"${weekStandoutSchemaHint()}","spurOfTheMoment":{"locationName":"<exact name from list>","hookLine":"<1 sentence ≤25 words>","confidence":<0.0-1.0>}}`;
}

export interface SpurInstructionsParams {
  homeLocationName: string;
  locationList: string;
}

export function buildSpurInstructions(p: SpurInstructionsParams): string {
  const { homeLocationName, locationList } = p;
  return `SPUR OF THE MOMENT — pick one location from this list that would reward a spontaneous drive today given today's season and conditions. Copy the name exactly as shown. hookLine: 1 evocative sentence, ≤25 words, no scores, no drive times, no "${homeLocationName}". confidence: 0.7+ only when the fit is clear and specific; omit the spurOfTheMoment key entirely if nothing stands out. Do not pick locations from the 'Nearby alternatives' section.
Locations: ${locationList}`;
}

export {
  weekStandoutSchemaHint,
  weekStandoutInstructionBlock,
  buildWeekStandoutInstructions,
};
