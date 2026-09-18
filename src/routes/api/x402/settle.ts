import { createFileRoute } from "@tanstack/react-router";
import { requirements, settlePayment, type PaymentPayload, type PaymentRequirements } from "@/lib/offer/x402";

export const Route = createFileRoute("/api/x402/settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { paymentPayload?: PaymentPayload; paymentRequirements?: PaymentRequirements };
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
        const reqs = body.paymentRequirements ?? requirements();
        const result = await settlePayment(body.paymentPayload, reqs);
        return Response.json(result, { status: result.success ? 200 : 402 });
      },
    },
  },
});
