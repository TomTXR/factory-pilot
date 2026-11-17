type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = (process.env.LOG_LEVEL as Level | undefined) ?? 'info';

function write(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (order[level] < order[minLevel]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(line + '\n');
}

/** Structured JSON logger. Use instead of console.* (see AGENTS.md). */
export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};
