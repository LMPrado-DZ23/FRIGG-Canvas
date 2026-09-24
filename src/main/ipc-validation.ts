export function boundedString(value: unknown, max: number, nonEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (!nonEmpty || value.length > 0);
}

export function validId(value: unknown): value is string {
  return boundedString(value, 128, true);
}

export function optionalBoundedString(value: unknown, max: number): value is string | undefined {
  return value === undefined || boundedString(value, max);
}

export function validAgentParams(value: unknown): value is { prompt: string; harness?: string; model?: string; cwd?: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return boundedString(p['prompt'], 100_000, true)
    && optionalBoundedString(p['harness'], 64)
    && optionalBoundedString(p['model'], 256)
    && optionalBoundedString(p['cwd'], 32_768);
}
