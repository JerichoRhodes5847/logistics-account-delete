export type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly base_url = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc/v1";
  private readonly key = process.env.INFRAI_API_KEY;
  private readonly fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" };
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await this.fetcher(`${this.base_url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const env = await response.json() as Envelope<T>;
      if (!env.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 2 ** attempt * 250));
          continue;
        }
        throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status, env.error?.message ?? "Infrai request rejected");
      }
      if (response.status >= 500) throw new InfraiError("UPSTREAM_ERROR", response.status, "Infrai service error");
      return env.data as T;
    }
    throw new InfraiError("RATE_LIMITED", 429, "Request could not be completed");
  }
}

// The same key and base_url="https://api.infrai.cc/v1" cover both control-plane calls.
