import { createFileRoute } from "@tanstack/react-router";
import { OffrePage } from "./offre";

export const Route = createFileRoute("/en/offre")({
  component: OffrePage,
  head: () => ({
    meta: [
      { title: "HANDOFF CERT · Offer" },
      {
        name: "description",
        content:
          "Two SKUs. Frozen 1.0 receipt at €0.001. Paid 1.2 grille at €0.05. Preview billing. No invented revenue.",
      },
    ],
  }),
});
