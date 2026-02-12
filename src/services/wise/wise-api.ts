const BASE_URL = "https://api.wise.com";

export class WiseApi {
  constructor(private readonly token: string) {}

  private async request<T>(method: string, path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) throw new Error(`Wise API error ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
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
