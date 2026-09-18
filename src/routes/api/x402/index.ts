import { createFileRoute } from "@tanstack/react-router";
import {
  AMOUNT_ATOMIC,
  X402_NETWORK,
  X402_SCHEME,
  X402_VERSION,
  enforced,
  nonceLedgerInfo,
  payTo,
  requirements,
  USDC_SEPOLIA,
} from "@/lib/offer/x402";
import { ensureSqlLedger } from "@/lib/offer/x402.server";

export const Route = createFileRoute("/api/x402/")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await ensureSqlLedger();
        } catch {
          /* discovery reste répondant ; settle, lui, fail-closed */
        }
        return Response.json({
          x402Version: X402_VERSION,
          facilitator: { verify: "/api/x402/verify", settle: "/api/x402/settle" },
          network: X402_NETWORK,
          scheme: X402_SCHEME,
          asset: USDC_SEPOLIA,
          amount: AMOUNT_ATOMIC,
          payTo: payTo(),
          enforced: enforced(),
          ledger: nonceLedgerInfo(),
          accepts: [requirements()],
        });
      },
    },
  },
});
