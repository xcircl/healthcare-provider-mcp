/**
 * Types mirroring the public xcircl API (https://xcircl.com/api/v1).
 *
 * Field tiering is enforced SERVER-SIDE by the API key. The SDK does no
 * hiding or unlocking of its own: paid fields are simply absent from
 * free-tier responses, which is why they are optional on `Provider`.
 */

/** Care verticals xcircl covers. Only verticals in `Coverage.verticals_live` have data today. */
export type Vertical = 'glp1' | 'pet_health' | 'medspa' | 'ivf' | 'dental' | 'senior';

export type BusinessMode = 'online' | 'physical' | 'both';

export type ApiTier = 'free' | 'paid';

/** Key plan, echoed by the API on every response. Field cut stays binary
 *  (free = identity, builder+ = full); plans differ in quota and verticals. */
export type ApiPlan = 'free' | 'builder' | 'developer' | 'enterprise';

/** Monthly call meter, present on metered plans (builder/developer). */
export interface UsageMeter {
  used: number;
  quota: number;
}

/**
 * Publication boundary of a response. `verified` (default for every tier) =
 * only records whose identity passed verification. `tracked` = the wider
 * monitored set, available as a free-tier transparency view via
 * `include: 'tracked'`.
 */
export type PublishBoundary = 'verified' | 'tracked';

/**
 * Verification state of a single signal. A signal is only `verified` when
 * the API holds BOTH a source AND a timestamp for it.
 */
export type SignalStatus =
  | 'verified' // positive fact, source + date held
  | 'clear' // negative screen that was actually run (e.g. no FDA warning letter on file)
  | 'flagged' // adverse finding on file
  | 'reported' // self-reported, not independently verified
  | 'unverified' // not yet checked
  | 'not_screened'; // screen not yet run

export interface SourcedSignal {
  status: SignalStatus;
  source: string | null;
  verified_at: string | null; // ISO 8601, or null
  source_url?: string | null;
}

export interface LicenseSignal extends SourcedSignal {
  states_count: number;
}

export interface ProviderPrice {
  /** Human-readable, e.g. "$429–$862/mo" */
  range: string | null;
  monthly_min: number | null;
  monthly_max: number | null;
  source: string | null;
  verified_at: string | null;
}

/** FREE-tier identity fields — sourced from public registries (NPPES etc.). */
export interface ProviderIdentity {
  entity_id: string;
  slug: string;
  vertical: Vertical;
  /** Present only in `include: 'tracked'` responses (row self-declares its boundary). */
  publish_tier?: 'verified' | 'internal_only';
  name: string;
  city: string | null;
  state: string | null;
  business_mode: BusinessMode;
  latitude: number | null;
  longitude: number | null;
  npi: string | null;
}

/**
 * A provider record. The four signal fields (`legitscript`, `license`, `fda`,
 * `price`) are PAID-tier — they only appear when the request carried a valid
 * paid API key. The server decides; the SDK just types them as optional.
 */
export interface Provider extends ProviderIdentity {
  legitscript?: SourcedSignal;
  license?: LicenseSignal;
  fda?: SourcedSignal;
  price?: ProviderPrice;
}

export interface SearchParams {
  vertical?: Vertical;
  /** Two-letter state code, e.g. "TX". */
  state?: string;
  city?: string;
  business_mode?: BusinessMode;
  /** 1–1000, server default 50. */
  limit?: number;
  offset?: number;
  /** Free-tier-only transparency view of the wider tracked set. */
  include?: 'tracked';
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  returned: number;
}

export interface SearchResponse {
  tier: ApiTier;
  plan?: ApiPlan;
  publish_boundary: PublishBoundary;
  /** Present on metered plans (builder/developer): monthly call meter. */
  usage?: UsageMeter;
  /** Present on free-tier responses: what a key would add, and where to get one. */
  notice?: string;
  pagination: Pagination;
  filters: {
    vertical: string | null;
    state: string | null;
    city: string | null;
    business_mode: string | null;
  };
  data: Provider[];
}

export interface ProviderResponse {
  tier: ApiTier;
  plan?: ApiPlan;
  publish_boundary: PublishBoundary;
  usage?: UsageMeter;
  notice?: string;
  data: Provider;
}

/** Compliance signals extracted from a provider record (paid tier). */
export interface ComplianceSignals {
  legitscript: SourcedSignal;
  license: LicenseSignal;
  fda: SourcedSignal;
}

export interface ComplianceResult {
  entity_id: string;
  slug: string;
  name: string;
  tier: ApiTier;
  plan?: ApiPlan;
  usage?: UsageMeter;
  /** `null` on the free tier — compliance signals are paid fields. */
  compliance: ComplianceSignals | null;
  /** Present when `compliance` is null: how to unlock it. */
  notice?: string;
}

export interface SignalCounts {
  legitscript_verified: number;
  license_on_file: number;
  fda_screened: number;
  npi_present: number;
  price_published: number;
}

export interface CoverageSlice {
  total: number;
  states: number;
  cities: number;
  business_mode: { online: number; physical: number; both: number };
  by_state: { state: string; count: number }[];
  signals?: SignalCounts;
}

/** Live coverage aggregate — free for everyone (it is the proof, not the product). */
export interface Coverage {
  tracked: CoverageSlice;
  verified: CoverageSlice;
  verticals_live: Vertical[];
  generated_at: string;
}

export interface SampleResponse {
  sample: true;
  size: number;
  schema: 'paid';
  publish_boundary: PublishBoundary;
  data: Provider[];
}
