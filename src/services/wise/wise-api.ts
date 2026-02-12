import { signScaChallenge } from "./sca";

const BASE_URL = "https://api.wise.com";

export class WiseApi {
  constructor(
    private readonly token: string,
    private readonly privateKey: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 403) {
      const oneTimeToken = response.headers.get("x-2fa-approval");
      if (oneTimeToken) {
        const signature = signScaChallenge(oneTimeToken, this.privateKey);
        const scaResponse = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: {
            ...headers,
            "x-2fa-approval": oneTimeToken,
            "X-Signature": signature,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!scaResponse.ok) throw new Error(`Wise API error ${scaResponse.status}: ${await scaResponse.text()}`);
        return scaResponse.json() as Promise<T>;
      }
    }

    if (!response.ok) throw new Error(`Wise API error ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }

  private async requestBuffer(method: string, path: string): Promise<Buffer> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };

    const response = await fetch(`${BASE_URL}${path}`, { method, headers });

    if (response.status === 403) {
      const oneTimeToken = response.headers.get("x-2fa-approval");
      if (oneTimeToken) {
        const signature = signScaChallenge(oneTimeToken, this.privateKey);
        const scaResponse = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: {
            ...headers,
            "x-2fa-approval": oneTimeToken,
            "X-Signature": signature,
          },
        });
        if (!scaResponse.ok) throw new Error(`Wise API error ${scaResponse.status}: ${await scaResponse.text()}`);
        return Buffer.from(await scaResponse.arrayBuffer());
      }
    }

    if (!response.ok) throw new Error(`Wise API error ${response.status}: ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }

  getProfiles(): Promise<WiseProfile[]> {
    return this.request("GET", "/v1/profiles");
  }

  getBalances(profileId: number): Promise<WiseBalance[]> {
    return this.request("GET", `/v4/profiles/${profileId}/balances?types=STANDARD,SAVINGS`);
  }

  getRates(source?: string, target?: string): Promise<WiseRate[]> {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (target) params.set("target", target);
    const qs = params.toString();
    return this.request("GET", `/v1/rates${qs ? `?${qs}` : ""}`);
  }

  getTransfers(profileId: number, params?: { status?: string; limit?: number }): Promise<WiseTransfer[]> {
    const qs = new URLSearchParams({ profile: String(profileId) });
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.request("GET", `/v1/transfers?${qs}`);
  }

  getTransfer(transferId: number): Promise<WiseTransfer> {
    return this.request("GET", `/v1/transfers/${transferId}`);
  }

  getStatement(profileId: number, balanceId: number, params: StatementParams): Promise<WiseStatement> {
    const qs = new URLSearchParams({
      intervalStart: params.startDate,
      intervalEnd: params.endDate,
      type: "COMPACT",
    });
    return this.request("GET", `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?${qs}`);
  }

  getStatementPdf(profileId: number, balanceId: number, params: StatementParams): Promise<Buffer> {
    const qs = new URLSearchParams({
      intervalStart: params.startDate,
      intervalEnd: params.endDate,
      type: "COMPACT",
    });
    return this.requestBuffer("GET", `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.pdf?${qs}`);
  }
}

export interface WiseProfile {
  id: number;
  type: "personal" | "business";
  fullName: string;
}

export interface WiseBalance {
  id: number;
  currency: string;
  amount: { value: number; currency: string };
  reservedAmount: { value: number; currency: string };
  type: string;
}

export interface WiseRate {
  source: string;
  target: string;
  rate: number;
  time: string;
}

export interface WiseTransfer {
  id: number;
  targetAccount: number;
  sourceAccount: number;
  status: string;
  reference: string;
  rate: number;
  created: string;
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  customerTransactionId: string;
}

export interface WiseStatement {
  transactions: WiseTransaction[];
}

export interface WiseTransaction {
  type: string;
  date: string;
  amount: { value: number; currency: string };
  totalFees: { value: number; currency: string };
  details: { type: string; description: string };
  runningBalance: { value: number; currency: string };
}

export interface StatementParams {
  startDate: string;
  endDate: string;
}
