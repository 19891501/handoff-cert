import { createFileRoute } from "@tanstack/react-router";
import { CapPage } from "./cap";

export const Route = createFileRoute("/en/cap")({
  component: CapPage,
  head: () => ({
    meta: [
      { title: "HANDOFF CERT · Cap" },
      {
        name: "description",
        content:
          "Horizon 2030: TLS of agent handoffs. V0 is a frozen receipt, not a safety gate.",
      },
    ],
  }),
});
