/**
 * XcirclClient — a thin fetch wrapper over https://xcircl.com/api/v1.
 *
 * Zero dependencies (Node 18+ global fetch). Every request uses an API key;
 * a free key returns identity fields and paid plans unlock additional fields.
 * Field tiering happens entirely server-side.
 *
 * Production-hardening:
 *   - retries 5xx and network errors with exponential backoff (never 4xx)
 *   - validates the response envelope shape and fails loudly (no silent
 *     mis-shaped data) — a hand-written check, so the SDK stays dependency-free
 */

import type {
  ComplianceResult,
  Coverage,
  Provider,
  ProviderResponse,
  SampleResponse,
  SearchParams,
  SearchResponse,
} from './types.js';

export const DEFAULT_BASE_URL = 'https://xcircl.com/api/v1';

/** The one-line paid-field hint shown whenever a response is free-tier.
 *  Deliberately carries no price: pricing lives on the website, single-sourced. */
export const UPGRADE_HINT =
  'Full fields (cash_price, compliance) require an API key → https://xcircl.com/developers/pricing/';

export interface XcirclClientOptions {
  /** xcircl API key. Free keys are available at xcircl.com/developers/signup. */
  apiKey: string;
  /** Override the API root — for testing only. */
  baseUrl?: string;
  /** Request timeout in milliseconds (default 30 000). */
  timeoutMs?: number;
  /** Custom fetch implementation (default: global fetch). */
  fetch?: typeof fetch;
  /** Retry attempts on 5xx / network errors (never on 4xx). Default 2. */
  maxRetries?: number;
  /** Base backoff in ms; delay is retryBaseMs * 2^attempt. Default 250. */
  retryBaseMs?: number;
  /** Validate the response envelope shape and throw on mismatch. Default true. */
  validateResponses?: boolean;
}

export class XcirclApiError extends Error {
  /** Server-provided upgrade path (e.g. on 403 vertical binding / 429 quota), verbatim. */
  public readonly upgrade?: string;
  /** The raw error body as returned by the API, for full-fidelity passthrough. */
  public readonly body?: unknown;

  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    extra?: { upgrade?: string; body?: unknown },
  ) {
    super(message);
    this.name = 'XcirclApiError';
    this.upgrade = extra?.upgrade;
    this.body = extra?.body;
  }
}

/** Thrown when a 2xx response doesn't match the expected envelope shape. */
export class XcirclSchemaError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly received: unknown,
  ) {
    super(message);
    this.name = 'XcirclSchemaError';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type Validator<T> = (data: unknown) => data is T;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Deliberately lenient envelope checks — they assert the few fields callers
 * depend on, so new server fields never break the client. Full type coverage
 * lives in the compile-time types; this is the runtime tripwire.
 */
const isSearchResponse: Validator<SearchResponse> = (d): d is SearchResponse =>
  isObject(d) && typeof d.tier === 'string' && Array.isArray(d.data);
const isProviderResponse: Validator<ProviderResponse> = (d): d is ProviderResponse =>
  isObject(d) && typeof d.tier === 'string' && isObject(d.data) && typeof d.data.entity_id === 'string';
const isCoverage: Validator<Coverage> = (d): d is Coverage =>
  isObject(d) && isObject(d.tracked) && isObject(d.verified);
const isSampleResponse: Validator<SampleResponse> = (d): d is SampleResponse =>
  isObject(d) && Array.isArray(d.data);

export class XcirclClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly validateResponses: boolean;

  constructor(options: XcirclClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new Error(
        'XcirclClient requires apiKey. Create a free key at https://xcircl.com/developers/signup/.',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? fetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 250;
    this.validateResponses = options.validateResponses ?? true;
  }

  private async request<T>(
    path: string,
    opts: {
      query?: Record<string, string | number | undefined>;
      validate?: Validator<T>;
      shape?: string;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    headers.authorization = `Bearer ${this.apiKey}`;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // Network / timeout error — retryable.
        if (attempt < this.maxRetries) {
          await sleep(this.retryBaseMs * 2 ** attempt);
          continue;
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw new XcirclApiError(`Request failed: ${reason}`, 0, url.toString());
      }

      if (!res.ok) {
        // 5xx is transient — retry with backoff. 4xx is the caller's problem — fail now.
        if (res.status >= 500 && attempt < this.maxRetries) {
          await sleep(this.retryBaseMs * 2 ** attempt);
          continue;
        }
        // Pass the server's words through verbatim — the API's 403/429 bodies
        // carry the vertical-binding / quota message plus an `upgrade` line,
        // and the client must not reword or gate them.
        let message = `HTTP ${res.status}`;
        let upgrade: string | undefined;
        let body: unknown;
        try {
          body = await res.json();
          const b = body as { error?: string; upgrade?: string };
          if (b?.error) message = b.error;
          if (b?.upgrade) upgrade = b.upgrade;
        } catch {
          /* non-JSON error body — keep the status message */
        }
        throw new XcirclApiError(message, res.status, url.toString(), { upgrade, body });
      }

      const json = (await res.json()) as unknown;
      if (this.validateResponses && opts.validate && !opts.validate(json)) {
        throw new XcirclSchemaError(
          `Unexpected response shape for ${opts.shape ?? path} from ${url.toString()} — ` +
            `the API may have changed, or a proxy returned non-xcircl content. ` +
            `Disable with validateResponses: false if this is expected.`,
          url.toString(),
          json,
        );
      }
      return json as T;
    }
  }

  /**
   * Search providers. All filters optional.
   * Free tier: identity fields + `notice`. Paid key: full records.
   */
  searchProviders(params: SearchParams = {}): Promise<SearchResponse> {
    return this.request<SearchResponse>('/providers/', {
      query: {
        vertical: params.vertical,
        state: params.state,
        city: params.city,
        business_mode: params.business_mode,
        limit: params.limit,
        offset: params.offset,
        include: params.include,
      },
      validate: isSearchResponse,
      shape: 'SearchResponse',
    });
  }

  /** Fetch one provider by `entity_id` or slug. Throws XcirclApiError(404) if not found. */
  getProvider(idOrSlug: string): Promise<ProviderResponse> {
    return this.request<ProviderResponse>(`/providers/${encodeURIComponent(idOrSlug)}/`, {
      validate: isProviderResponse,
      shape: 'ProviderResponse',
    });
  }

  /**
   * Compliance signals (LegitScript / state licenses / FDA) for one provider.
   * These are plan-gated fields: a free key returns the provider's identity,
   * `compliance: null`, and a notice explaining how to unlock them.
   */
  async checkCompliance(idOrSlug: string): Promise<ComplianceResult> {
    const res = await this.getProvider(idOrSlug);
    const p: Provider = res.data;
    const hasSignals = p.legitscript !== undefined && p.license !== undefined && p.fda !== undefined;
    return {
      entity_id: p.entity_id,
      slug: p.slug,
      name: p.name,
      tier: res.tier,
      ...(res.plan !== undefined ? { plan: res.plan } : {}),
      ...(res.usage !== undefined ? { usage: res.usage } : {}),
      compliance: hasSignals
        ? { legitscript: p.legitscript!, license: p.license!, fda: p.fda! }
        : null,
      ...(hasSignals ? {} : { notice: UPGRADE_HINT }),
    };
  }

  /** Live coverage counts (free for everyone). */
  getCoverage(): Promise<Coverage> {
    return this.request<Coverage>('/coverage/', { validate: isCoverage, shape: 'Coverage' });
  }

  /** Small clean demo set (~50 records, paid schema) for docs and tests. */
  getSample(): Promise<SampleResponse> {
    return this.request<SampleResponse>('/sample/', {
      validate: isSampleResponse,
      shape: 'SampleResponse',
    });
  }
}
