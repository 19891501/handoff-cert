import { createFileRoute } from "@tanstack/react-router";
import { requirements, verifyPayment, type PaymentPayload, type PaymentRequirements } from "@/lib/offer/x402";

export const Route = createFileRoute("/api/x402/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { paymentPayload?: PaymentPayload; paymentRequirements?: PaymentRequirements };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ isValid: false, invalidReason: "json" }, { status: 400 });
        }
        if (!body.paymentPayload) {
          return Response.json({ isValid: false, invalidReason: "paymentPayload_missing" }, { status: 400 });
        }
        const reqs = body.paymentRequirements ?? requirements();
        const result = await verifyPayment(body.paymentPayload, reqs);
        return Response.json(result);
      },
    },
  },
});
