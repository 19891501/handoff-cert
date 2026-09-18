import { createFileRoute } from "@tanstack/react-router";
import { hostedRequirements, settlePayment, type PaymentPayload } from "@/lib/offer/x402";
import { ensureSqlLedger } from "@/lib/offer/x402.server";

export const Route = createFileRoute("/api/x402/settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await ensureSqlLedger();
        let body: { paymentPayload?: PaymentPayload };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json(
            { success: false, errorReason: "json", transaction: "", network: "base-sepolia" },
            { status: 400 },
          );
        }
        if (!body.paymentPayload) {
          return Response.json(
            { success: false, errorReason: "paymentPayload_missing", transaction: "", network: "base-sepolia" },
            { status: 400 },
          );
        }
        const reqs = hostedRequirements();
        const result = await settlePayment(body.paymentPayload, reqs);
        return Response.json(result, { status: result.success ? 200 : 402 });
      },
    },
  },
});
