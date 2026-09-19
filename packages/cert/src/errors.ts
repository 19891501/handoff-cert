export class HandoffCertError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status = 0, body?: unknown) {
    super(message);
    this.name = "HandoffCertError";
    this.status = status;
    this.body = body;
  }
}

/** HTTP 402 — payment required. Body is the server's; we do not invent a hash. */
export class PaymentRequiredError extends HandoffCertError {
  constructor(body?: unknown) {
    super("payment required", 402, body);
    this.name = "PaymentRequiredError";
  }
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}
