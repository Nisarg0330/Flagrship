import { CliError } from './config';

export interface ApiErrorBody {
  error: { code: string; message: string; field?: string; request_id: string };
}

export interface Client {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createClient(apiUrl: string, apiKey: string, verbose = false): Client {
  const base = apiUrl.replace(/\/+$/, '');

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${base}/api/v1${path}`;
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'user-agent': `flagrship-cli/${CLI_VERSION}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (verbose) console.error(`> ${method} ${url}${attempt ? ` (retry ${attempt})` : ''}`);

      let res: Response;
      try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (err) {
        // Network-level failure: DNS, refused, timeout. Worth retrying.
        lastError = err as Error;
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (verbose) console.error(`< ${res.status} ${res.headers.get('x-request-id') ?? ''}`);

      if (res.status >= 500) {
        // The server broke, not the request. Retry.
        lastError = new Error(`${res.status} from ${method} ${path}`);
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (res.status === 204 || res.status === 304) return undefined as T;

      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        throw new CliError(`Unexpected non-JSON response (${res.status}) from ${method} ${path}.`);
      }

      if (!res.ok) {
        // A 4xx is the API telling us exactly what is wrong. Surface it verbatim,
        // never retry it.
        const { error } = json as ApiErrorBody;
        const where = error?.field ? ` (${error.field})` : '';
        throw new CliError(
          `${error?.message ?? res.statusText}${where}\n  request id: ${error?.request_id ?? 'n/a'}`,
        );
      }

      return json as T;
    }

    throw new CliError(
      `Could not reach ${base} after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    delete: (path) => request('DELETE', path),
  };
}

// Replaced at build time is overkill for now; bump by hand with package.json.
export const CLI_VERSION = '0.0.1';
