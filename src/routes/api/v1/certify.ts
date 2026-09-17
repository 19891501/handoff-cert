import { createFileRoute } from "@tanstack/react-router";
import { OFFER } from "@/lib/offer/catalog";
import { serveCertify } from "@/lib/offer/serve";

export const Route = createFileRoute("/api/v1/certify")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          sku: OFFER.sku,
          endpoint: OFFER.endpoint,
          price_eur: OFFER.price_eur,
          billing: OFFER.billing,
          method: "POST",
        }),
      POST: async ({ request }) => {
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ erreur: "JSON invalide" }, { status: 400 });
        }
        try {
          const result = await serveCertify(body);
          return Response.json(result);
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
