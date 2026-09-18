import {
  recoverTypedDataAddress,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";

export const X402_VERSION = 1;
export const X402_SCHEME = "exact";
export const X402_NETWORK = "base-sepolia";
export const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
export const CHAIN_ID = 84532;
/** 0.001 USDC — atomic (6 decimals). Aligné sur le prix affiché 0,001 € en testnet. */
export const AMOUNT_ATOMIC = "1000";

const TRANSFER_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const usedNonces = new Set<string>();

export function payTo(): Address | null {
  const raw = process.env.X402_PAY_TO?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{40}$/.test(raw)) return null;
  return raw as Address;
}

export function settlerKey(): Hex | null {
  const raw = process.env.X402_SETTLER_KEY?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  return raw as Hex;
}

export function enforced(): boolean {
  return Boolean(payTo());
}

export interface PaymentRequirements {
  scheme: typeof X402_SCHEME;
  network: typeof X402_NETWORK;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: Hex;
    authorization: {
      from: Address;
      to: Address;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: Hex;
    };
  };
}

export function requirements(resource = "/api/v1/certify"): PaymentRequirements {
  return {
    scheme: X402_SCHEME,
    network: X402_NETWORK,
    maxAmountRequired: AMOUNT_ATOMIC,
    asset: USDC_SEPOLIA,
    payTo: payTo() ?? ("0x0000000000000000000000000000000000000000" as Address),
    resource,
    description: "HANDOFF CERT — un certificat",
    mimeType: "application/json",
    maxTimeoutSeconds: 60,
    extra: { name: "USDC", version: "2" },
  };
}

export function paymentRequiredBody(error: string, resource?: string) {
  return {
    x402Version: X402_VERSION,
    error,
    accepts: [requirements(resource)],
  };
}

export function eip712Domain() {
  return {
    name: "USDC",
    version: "2",
    chainId: CHAIN_ID,
    verifyingContract: USDC_SEPOLIA,
  } as const;
}

export function typedMessage(auth: PaymentPayload["payload"]["authorization"]) {
  return {
    from: auth.from,
    to: auth.to,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce,
  };
}

export async function signExact(
  account: {
    address: Address;
    signTypedData: (args: {
      domain: ReturnType<typeof eip712Domain>;
      types: typeof TRANSFER_TYPES;
      primaryType: "TransferWithAuthorization";
      message: ReturnType<typeof typedMessage>;
    }) => Promise<Hex>;
  },
  to: Address,
  value = AMOUNT_ATOMIC,
  now = Math.floor(Date.now() / 1000),
): Promise<PaymentPayload> {
  const nonce = `0x${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(
    0,
    66,
  ) as Hex;
  const authorization = {
    from: account.address,
    to,
    value,
    validAfter: String(now - 30),
    validBefore: String(now + 120),
    nonce,
  };
  const signature = await account.signTypedData({
    domain: eip712Domain(),
    types: TRANSFER_TYPES,
    primaryType: "TransferWithAuthorization",
    message: typedMessage(authorization),
  });
  return {
    x402Version: X402_VERSION,
    scheme: X402_SCHEME,
    network: X402_NETWORK,
    payload: { signature, authorization },
  };
}

export function parsePaymentHeader(header: string | null): PaymentPayload | null {
  if (!header?.trim()) return null;
  const raw = header.trim();
  try {
    const json = raw.startsWith("{")
      ? raw
      : new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
    const parsed = JSON.parse(json) as PaymentPayload;
    if (!parsed?.payload?.signature || !parsed.payload.authorization) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface VerifyResult {
  isValid: boolean;
  payer?: Address;
  invalidReason?: string;
}

export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  now = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  if (paymentPayload.x402Version !== X402_VERSION) {
    return { isValid: false, invalidReason: "version_mismatch" };
  }
  if (paymentPayload.scheme !== paymentRequirements.scheme) {
    return { isValid: false, invalidReason: "scheme_mismatch" };
  }
  if (paymentPayload.network !== paymentRequirements.network) {
    return { isValid: false, invalidReason: "network_mismatch" };
  }
  const merchant = paymentRequirements.payTo;
  if (!merchant || merchant === "0x0000000000000000000000000000000000000000") {
    return { isValid: false, invalidReason: "merchant_unconfigured" };
  }
  const auth = paymentPayload.payload.authorization;
  if (auth.to.toLowerCase() !== merchant.toLowerCase()) {
    return { isValid: false, invalidReason: "payTo_mismatch" };
  }
  if (auth.value !== paymentRequirements.maxAmountRequired) {
    return { isValid: false, invalidReason: "amount_mismatch" };
  }
  if (paymentRequirements.asset.toLowerCase() !== USDC_SEPOLIA.toLowerCase()) {
    return { isValid: false, invalidReason: "asset_mismatch" };
  }
  const after = Number(auth.validAfter);
  const before = Number(auth.validBefore);
  if (!Number.isFinite(after) || !Number.isFinite(before) || after > now || now >= before) {
    return { isValid: false, invalidReason: "window_expired" };
  }
  if (usedNonces.has(auth.nonce.toLowerCase())) {
    return { isValid: false, invalidReason: "nonce_replay" };
  }

  const domain = eip712Domain();
  const message = typedMessage(auth);
  let recovered: Address;
  try {
    const ok = await verifyTypedData({
      address: auth.from,
      domain,
      types: TRANSFER_TYPES,
      primaryType: "TransferWithAuthorization",
      message,
      signature: paymentPayload.payload.signature,
    });
    if (!ok) return { isValid: false, payer: auth.from, invalidReason: "bad_signature" };
    recovered = await recoverTypedDataAddress({
      domain,
      types: TRANSFER_TYPES,
      primaryType: "TransferWithAuthorization",
      message,
      signature: paymentPayload.payload.signature,
    });
  } catch {
    return { isValid: false, invalidReason: "bad_signature" };
  }
  if (recovered.toLowerCase() !== auth.from.toLowerCase()) {
    return { isValid: false, payer: recovered, invalidReason: "signer_mismatch" };
  }
  return { isValid: true, payer: recovered };
}

/** Test-only: forget a nonce so a fixture can be reused. */
export function forgetNonce(nonce: string) {
  usedNonces.delete(nonce.toLowerCase());
}

export interface SettleResult {
  success: boolean;
  payer?: Address;
  transaction: string;
  network: typeof X402_NETWORK;
  errorReason?: string;
}

export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResult> {
  const verified = await verifyPayment(paymentPayload, paymentRequirements);
  if (!verified.isValid) {
    return {
      success: false,
      payer: verified.payer,
      transaction: "",
      network: X402_NETWORK,
      errorReason: verified.invalidReason,
    };
  }
  const key = settlerKey();
  if (!key) {
    return {
      success: false,
      payer: verified.payer,
      transaction: "",
      network: X402_NETWORK,
      errorReason: "no_settler_key",
    };
  }
  const { createWalletClient, http, getContract } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { baseSepolia } = await import("viem/chains");
  const account = privateKeyToAccount(key);
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.X402_RPC ?? "https://sepolia.base.org"),
  });
  const usdc = getContract({
    address: USDC_SEPOLIA,
    abi: [
      {
        type: "function",
        name: "transferWithAuthorization",
        stateMutability: "nonpayable",
        inputs: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
          { name: "signature", type: "bytes" },
        ],
        outputs: [],
      },
    ] as const,
    client,
  });
  const auth = paymentPayload.payload.authorization;
  try {
    const hash = await usdc.write.transferWithAuthorization([
      auth.from,
      auth.to,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce,
      paymentPayload.payload.signature,
    ]);
    usedNonces.add(auth.nonce.toLowerCase());
    return {
      success: true,
      payer: verified.payer,
      transaction: hash,
      network: X402_NETWORK,
    };
  } catch (e) {
    return {
      success: false,
      payer: verified.payer,
      transaction: "",
      network: X402_NETWORK,
      errorReason: e instanceof Error ? e.message : "settle_failed",
    };
  }
}

export async function gateCertify(request: Request): Promise<
  | { ok: true; payer: Address; transaction: string }
  | { ok: false; status: 402; body: unknown }
> {
  if (!enforced()) {
    return { ok: true, payer: "0x0000000000000000000000000000000000000000", transaction: "" };
  }
  const reqs = requirements(new URL(request.url).pathname);
  const header =
    request.headers.get("X-PAYMENT") ?? request.headers.get("PAYMENT-SIGNATURE");
  const payload = parsePaymentHeader(header);
  if (!payload) {
    return {
      ok: false,
      status: 402,
      body: paymentRequiredBody("X-PAYMENT header is required"),
    };
  }
  const settled = await settlePayment(payload, reqs);
  if (!settled.success) {
    return {
      ok: false,
      status: 402,
      body: {
        ...paymentRequiredBody(settled.errorReason ?? "payment_invalid"),
        settlement: settled,
      },
    };
  }
  return { ok: true, payer: settled.payer!, transaction: settled.transaction };
}
