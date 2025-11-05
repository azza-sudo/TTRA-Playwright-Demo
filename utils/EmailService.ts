// utils/EmailService.ts
// Node 18+ is recommended (global `fetch`). On older Node, install `node-fetch` and polyfill.
// Env overrides:
//   EMAIL_BASE_URL  -> force a specific base (e.g. https://api.mail.tm/)
//   EMAIL_DOMAIN    -> force a specific domain (skips /domains call)

export type HydraMessagesResponse = {
  "hydra:member": MessageItem[];
  "hydra:totalItems": number;
};

export type MessageItem = {
  id: string;
  subject?: string;
  intro?: string; // short preview/body
  // ...extend with more API fields if needed
};

const DEFAULT_BASES = ["https://api.mail.gw/", "https://api.mail.tm/"];
const ENV_BASE = process.env.EMAIL_BASE_URL;
const ENV_DOMAIN = process.env.EMAIL_DOMAIN;
const MAX_RETRIES = 6;

export default class EmailService {
  private readonly staticPassword = "someStringPassword";

  // Prefer ENV base; otherwise try known providers in order
  private bases: string[] = ENV_BASE ? [ENV_BASE] : [...DEFAULT_BASES];
  private activeBase: string = this.bases[0];

  // Cache tokens per account
  private tokenCache = new Map<string, string>();

  /**
   * Create a unique inbox like "<adminName>@<valid-domain>".
   * You can force a domain via param or set EMAIL_DOMAIN.
   */
  async createUniqueEmail(
    adminName: string,
    domainOverride?: string
  ): Promise<string> {
    const domain = domainOverride ?? ENV_DOMAIN ?? (await this.getValidDomain());
    const emailAddress = `${adminName}@${domain}`;
    const payload = { address: emailAddress, password: this.staticPassword };

    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(this.url("accounts"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 201) {
          const json = (await res.json()) as { address?: string };
          if (!json.address) throw new Error("Create email: missing 'address'");
          return json.address;
        }

        const body = await res.text().catch(() => "");
        // Retry 5xx
        if (res.status >= 500 && res.status < 600) {
          await this.sleep(2 ** attempt * 300);
          continue;
        }
        throw new Error(
          `createUniqueEmail failed. Status: ${res.status}. Body: ${
            body || "<empty>"
          }`
        );
      } catch (e) {
        lastErr = e;
        await this.sleep(2 ** attempt * 300);
      }
    }
    throw new Error(
      `createUniqueEmail failed after retries. Last error: ${String(lastErr)}`
    );
  }

  /** Get JWT token for an account (cached). */
  async getAccountToken(accountEmail: string): Promise<string> {
    const cached = this.tokenCache.get(accountEmail);
    if (cached) return cached;

    const payload = { address: accountEmail, password: this.staticPassword };
    const { json } = await this.fetchJsonRetry<{ token?: string }>(
      this.url("token"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      (r) => r.status === 200,
      "getAccountToken"
    );

    if (!json.token) throw new Error("Token not found in response.");
    this.tokenCache.set(accountEmail, json.token);
    return json.token;
  }

  /** Get all messages for an account. */
  async getAllMessages(accountEmail: string): Promise<HydraMessagesResponse> {
    const token = await this.getAccountToken(accountEmail);
    const { json } = await this.fetchJsonRetry<HydraMessagesResponse>(
      this.url("messages"),
      {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      (r) => r.status === 200,
      "getAllMessages"
    );
    return json;
  }

  /** Get a single message by id. */
  async getMessage(accountEmail: string, msgId: string): Promise<any> {
    const token = await this.getAccountToken(accountEmail);
    const { json } = await this.fetchJsonRetry<any>(
      this.url(`messages/${msgId}`),
      {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      (r) => r.status === 200,
      "getMessage"
    );
    return json;
  }

  /** Collect all subjects. */
  async getAllEmailsSubjects(accountEmail: string): Promise<string[]> {
    const data = await this.getAllMessages(accountEmail);
    return data["hydra:member"].map((m) => m.subject ?? "");
  }

  /** Collect all intros/bodies. */
  async getAllEmailsBodies(accountEmail: string): Promise<string[]> {
    const data = await this.getAllMessages(accountEmail);
    return data["hydra:member"].map((m) => m.intro ?? "");
  }

  /** Collect all ids. */
  async getAllEmailsIds(accountEmail: string): Promise<string[]> {
    const data = await this.getAllMessages(accountEmail);
    return data["hydra:member"].map((m) => m.id);
  }

  /**
   * Get a valid domain by querying /domains.
   * - Uses EMAIL_DOMAIN if set (skips the call).
   * - Fails over across known bases (mail.gw, mail.tm).
   * - Retries with exponential backoff on 5xx.
   */
  async getValidDomain(): Promise<string> {
    if (ENV_DOMAIN) return ENV_DOMAIN;

    let lastErr: unknown = null;
    for (const base of this.bases) {
      this.activeBase = base;
      try {
        type DomainsResp = { "hydra:member": Array<{ domain: string }> };
        const { json } = await this.fetchJsonRetry<DomainsResp>(
          this.url("domains"),
          { headers: { accept: "application/ld+json" } },
          (r) => r.status === 200,
          `getValidDomain (${base})`
        );

        const first = json["hydra:member"]?.[0]?.domain;
        if (!first) throw new Error("No domain found in response.");
        return first;
      } catch (e) {
        lastErr = e; // try next base
      }
    }
    throw new Error(
      `getValidDomain failed across all bases. Last error: ${String(lastErr)}`
    );
  }

  /** Find the first email body that contains the substring (case-insensitive). */
  async getEmailBodyByPartialContent(
    emailAddress: string,
    partOfEmailBody: string
  ): Promise<string | null> {
    const bodies = await this.getAllEmailsBodies(emailAddress);
    const target = partOfEmailBody.toLowerCase();
    for (const body of bodies) {
      if (body.toLowerCase().includes(target)) return body;
    }
    return null;
  }

  /**
   * Legacy simple wait: poll inbox until there are at least N emails
   * (<=45s total, every 5s). Returns true if threshold is reached.
   */
  async waitUntilInboxToHaveEmails(
    accountEmail: string,
    numberOfExpectedEmails: number
  ): Promise<boolean> {
    const hasEnough = async () => {
      const data = await this.getAllMessages(accountEmail);
      return data["hydra:totalItems"] >= numberOfExpectedEmails;
    };

    if (await hasEnough()) return true;

    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await this.sleep(5_000);
      if (await hasEnough()) return true;
    }
    return false;
  }

  // -------- New, more flexible waits --------

  /** Poll until inbox has at least `minCount` messages (configurable timeout/poll). */
  async waitForEmails(
    accountEmail: string,
    opts: { minCount?: number; timeoutMs?: number; pollMs?: number } = {}
  ): Promise<boolean> {
    const minCount = opts.minCount ?? 1;
    const timeoutMs = opts.timeoutMs ?? 120_000; // default 2 minutes
    const pollMs = opts.pollMs ?? 3_000;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const data = await this.getAllMessages(accountEmail);
      if (data["hydra:totalItems"] >= minCount) return true;
      await this.sleep(pollMs);
    }
    return false;
  }

  /** Poll until a subject matches the regex. Returns the matching message or null on timeout. */
  async waitForSubject(
    accountEmail: string,
    subjectRegex: RegExp,
    opts: { timeoutMs?: number; pollMs?: number } = {}
  ): Promise<MessageItem | null> {
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const pollMs = opts.pollMs ?? 3_000;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const data = await this.getAllMessages(accountEmail);
      const hit = data["hydra:member"].find(
        (m) => m.subject && subjectRegex.test(m.subject)
      );
      if (hit) return hit;
      await this.sleep(pollMs);
    }
    return null;
  }

  /** Poll until any body/intro contains `needle` (case-insensitive). Returns the matching message or null. */
  async waitForBodyContains(
    accountEmail: string,
    needle: string,
    opts: { timeoutMs?: number; pollMs?: number } = {}
  ): Promise<MessageItem | null> {
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const pollMs = opts.pollMs ?? 3_000;
    const target = needle.toLowerCase();

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const data = await this.getAllMessages(accountEmail);
      const hit = data["hydra:member"].find((m) =>
        (m.intro ?? "").toLowerCase().includes(target)
      );
      if (hit) return hit;
      await this.sleep(pollMs);
    }
    return null;
  }

  // ---------- Helpers ----------

  private url(path: string): string {
    return new URL(path, this.activeBase).toString();
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  /**
   * Generic "fetch then JSON" with retries.
   * Retries on network errors and 5xx responses (exponential backoff).
   */
  private async fetchJsonRetry<T>(
    input: string | URL,
    init: RequestInit,
    isOk: (r: Response) => boolean = (r) => r.ok,
    label = "request"
  ): Promise<{ json: T; res: Response }> {
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(input, init);
        if (isOk(res)) {
          const json = (await res.json()) as T;
          return { json, res };
        }

        const body = await res.text().catch(() => "");
        if (res.status >= 500 && res.status < 600) {
          await this.sleep(2 ** attempt * 300);
          continue;
        }
        throw new Error(
          `${label} failed. Status: ${res.status}. Body: ${body || "<empty>"}`
        );
      } catch (e) {
        lastErr = e;
        await this.sleep(2 ** attempt * 300);
      }
    }

    throw new Error(`${label} failed after retries. Last error: ${String(lastErr)}`);
  }
}
