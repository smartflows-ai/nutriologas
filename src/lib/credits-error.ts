// src/lib/credits-error.ts
// Thrown when a tenant's AI credit limit is exhausted.

export class CreditExhaustedError extends Error {
  public readonly usedUsd: number;
  public readonly limitUsd: number;

  constructor(usedUsd: number, limitUsd: number) {
    super("AI credit limit exceeded");
    this.name = "CreditExhaustedError";
    this.usedUsd = usedUsd;
    this.limitUsd = limitUsd;
  }
}
