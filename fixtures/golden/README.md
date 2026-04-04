# Golden Fixtures

Golden fixtures provide baseline test data for the `finalizeBrief` editorial generation function. These fixtures serve as the source of truth for expected behavior across different AI provider scenarios.

## What Are Golden Fixtures?

Golden fixtures are JSON files containing predefined inputs and expected AI responses. They allow tests to run deterministically without making actual API calls to Groq or Gemini. Each fixture represents a specific scenario that the editorial system must handle correctly.

## Fixture Scenarios

| Fixture | Description | Expected Behavior |
|---------|-------------|-------------------|
| `good-local-window.json` | Happy path - local conditions are good (78/100 score) | Groq selected, no fallback needed |
| `dont-bother.json` | Poor conditions - dontBother flag set, low scores (32/100) | Groq selected, alt locations suggested |
| `groq-succeeds-gemini-empty.json` | Primary provider works, secondary empty | Groq selected, Gemini ignored |
| `groq-malformed-gemini-usable.json` | Primary fails (malformed JSON), secondary works | Model fallback to Gemini |
| `both-fail-template-fallback.json` | Both AI providers fail | Template fallback used |

## Fixture Structure

Each fixture contains:

```json
{
  "_comment": "Description of the scenario",
  "scenario": "fixture-name",
  "description": "Human-readable description",
  "context": { /* Weather data, windows, alt locations, sun/moon times */ },
  "groqChoices": [ /* Simulated Groq API response */ ],
  "geminiResponse": "Simulated Gemini response string",
  "homeLocation": { /* Location config */ },
  "debug": { /* Debug settings */ },
  "preferredProvider": "groq"
}
```

## Running the Tests

The golden fixture tests are in:
```
src/app/run-photo-brief/finalize-brief.golden-fixtures.test.ts
```

Run with:
```bash
npm test -- finalize-brief.golden-fixtures.test.ts
```

## When to Update Fixtures

- **New scenarios**: Add a fixture when a new edge case is discovered
- **Behavior changes**: Update fixtures when expected behavior changes intentionally
- **Provider updates**: Update mock responses when AI provider formats change

## Golden Fixture Philosophy

1. **Deterministic**: Fixtures produce the same result every time
2. **Isolated**: No external API calls during test execution
3. **Documented**: Each fixture clearly describes its purpose
4. **Comprehensive**: Cover happy path, edge cases, and failure modes
