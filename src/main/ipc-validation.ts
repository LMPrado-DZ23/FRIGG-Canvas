export function boundedString(value: unknown, max: number, nonEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (!nonEmpty || value.length > 0);
}

export function validId(value: unknown): value is string {
  return boundedString(value, 128, true);
}

export function optionalBoundedString(value: unknown, max: number): value is string | undefined {
  return value === undefined || boundedString(value, max);
}

/** Nome de modelo: token simples (ex.: sonnet, claude-sonnet-4-5, openai/gpt-5, sonnet[1m]). */
export function validModelName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:/@[\]-]{1,256}$/.test(value);
}

export function validAgentParams(value: unknown): value is { prompt: string; harness?: string; model?: string; cwd?: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return boundedString(p['prompt'], 100_000, true)
    && optionalBoundedString(p['harness'], 64)
    && (p['model'] === undefined || p['model'] === '' || validModelName(p['model']))
    && optionalBoundedString(p['cwd'], 32_768);
}
