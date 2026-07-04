/**
 * XcirclClient — a thin fetch wrapper over https://xcircl.com/api/v1.
 *
 * Zero dependencies (Node 18+ global fetch). Works without an API key:
 * the free tier returns identity fields plus a `notice` telling you what a
 * key unlocks. Field tiering happens entirely server-side.
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

/** The one-line paid-field hint shown whenever a response is free-tier. */
export const UPGRADE_HINT =
  'Full fields (cash_price, compliance) from $99/mo self-serve → https://xcircl.com/developers/';

export interface XcirclClientOptions {
  /** xcircl API key. Omit for the free tier (identity fields only). */
  apiKey?: string;
  /** Override the API root — for testing only. */
  baseUrl?: string;
  /** Request timeout in milliseconds (default 30 000). */
  timeoutMs?: number;
  /** Custom fetch implementation (default: global fetch). */
  fetch?: typeof fetch;
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

export class XcirclClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: XcirclClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new XcirclApiError(`Request failed: ${reason}`, 0, url.toString());
    }

    if (!res.ok) {
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
    return (await res.json()) as T;
  }

  /**
   * Search providers. All filters optional.
   * Free tier: identity fields + `notice`. Paid key: full records.
   */
  searchProviders(params: SearchParams = {}): Promise<SearchResponse> {
    return this.request<SearchResponse>('/providers/', {
      vertical: params.vertical,
      state: params.state,
      city: params.city,
      business_mode: params.business_mode,
      limit: params.limit,
      offset: params.offset,
      include: params.include,
    });
  }

  /** Fetch one provider by `entity_id` or slug. Throws XcirclApiError(404) if not found. */
  getProvider(idOrSlug: string): Promise<ProviderResponse> {
    return this.request<ProviderResponse>(`/providers/${encodeURIComponent(idOrSlug)}/`);
  }

  /**
   * Compliance signals (LegitScript / state licenses / FDA) for one provider.
   * These are paid fields: without a key you get the provider's identity,
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
    return this.request<Coverage>('/coverage/');
  }

  /** Small clean demo set (~50 records, paid schema) for docs and tests. */
  getSample(): Promise<SampleResponse> {
    return this.request<SampleResponse>('/sample/');
  }
}
