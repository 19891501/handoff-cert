import { createFileRoute } from "@tanstack/react-router";
import { OFFER } from "@/lib/offer/catalog";
import { serveCertify } from "@/lib/offer/serve";
import {
  AMOUNT_ATOMIC,
  X402_NETWORK,
  enforced,
  gateCertify,
  nonceLedgerInfo,
  payTo,
  requirements,
} from "@/lib/offer/x402";
import { ensureSqlLedger } from "@/lib/offer/x402.server";

export const Route = createFileRoute("/api/v1/certify")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await ensureSqlLedger();
        } catch {
          /* catalogue public */
        }
        return Response.json({
          sku: OFFER.sku,
          endpoint: OFFER.endpoint,
          price_eur: OFFER.price_eur,
          billing: enforced() ? "x402" : OFFER.billing,
          method: "POST",
          x402: {
            network: X402_NETWORK,
            amount: AMOUNT_ATOMIC,
            payTo: payTo(),
            enforced: enforced(),
            facilitator: "/api/x402",
            ledger: nonceLedgerInfo(),
            accepts: [requirements()],
          },
        });
      },
      POST: async ({ request }) => {
        await ensureSqlLedger();
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ erreur: "JSON invalide" }, { status: 400 });
        }
        const gate = await gateCertify(request);
        if (!gate.ok) {
          return Response.json(gate.body, { status: 402 });
        }
        try {
          const result = await serveCertify(body);
          return Response.json({
            ...result,
            offer: {
              ...result.offer,
              billing: enforced() ? "x402" : result.offer.billing,
            },
            payment: enforced()
              ? { payer: gate.payer, transaction: gate.transaction, network: X402_NETWORK }
              : { billing: "preview" },
          });
        } catch (e) {
          return Response.json(
            { erreur: e instanceof Error ? e.message : "certification impossible" },
            { status: 400 },
          );
        }
      },
    },
  },
});
