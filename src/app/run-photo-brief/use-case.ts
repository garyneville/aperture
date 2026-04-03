import type {
  EditorialDecision,
  EditorialRequest,
  ForecastBundle,
  RenderedOutputs,
  RunnerStage,
  ScoredForecastContext,
  StandaloneBriefRun,
} from './contracts.js';

export interface StandaloneRunnerDependencies {
  acquireForecastBundle(): Promise<ForecastBundle>;
  scoreForecast(bundle: ForecastBundle): Promise<ScoredForecastContext>;
  buildEditorialRequest(scoredContext: ScoredForecastContext): Promise<EditorialRequest>;
  resolveEditorial(request: EditorialRequest): Promise<EditorialDecision>;
  renderBrief(scoredContext: ScoredForecastContext, editorial: EditorialDecision): Promise<RenderedOutputs>;
  persistRun?(run: StandaloneBriefRun): Promise<void>;
  deliverOutputs?(run: StandaloneBriefRun): Promise<void>;
  now?(): Date;
}

async function timeStage<T>(
  stageTimingsMs: Partial<Record<RunnerStage, number>>,
  stage: RunnerStage,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const result = await work();
  stageTimingsMs[stage] = Date.now() - startedAt;
  return result;
}

export async function runPhotoBrief(deps: StandaloneRunnerDependencies): Promise<StandaloneBriefRun> {
  const stageTimingsMs: Partial<Record<RunnerStage, number>> = {};
  const generatedAt = (deps.now ? deps.now() : new Date()).toISOString();

  const forecast = await timeStage(stageTimingsMs, 'acquire', () => deps.acquireForecastBundle());
  const scoredContext = await timeStage(stageTimingsMs, 'score', () => deps.scoreForecast(forecast));
  const editorialRequest = await timeStage(stageTimingsMs, 'buildEditorialRequest', () => deps.buildEditorialRequest(scoredContext));
  const editorial = await timeStage(stageTimingsMs, 'resolveEditorial', () => deps.resolveEditorial(editorialRequest));
  const outputs = await timeStage(stageTimingsMs, 'render', () => deps.renderBrief(scoredContext, editorial));

  const run: StandaloneBriefRun = {
    generatedAt,
    forecast,
    scoredContext,
    editorialRequest,
    editorial,
    outputs,
    stageTimingsMs,
  };

  if (deps.persistRun) {
    await timeStage(stageTimingsMs, 'persist', () => deps.persistRun!(run));
  }

  if (deps.deliverOutputs) {
    await timeStage(stageTimingsMs, 'deliver', () => deps.deliverOutputs!(run));
  }

  return run;
}
