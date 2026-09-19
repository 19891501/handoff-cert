import { createFileRoute } from "@tanstack/react-router";
import { LIVE, MISSION, TARGETS, liveSnapshot } from "@/lib/offer/mission";

export const Route = createFileRoute("/api/v1/cap")({
  server: {
    handlers: {
      GET: async () => {
        const live = liveSnapshot();
        return Response.json({
          live,
          horizon: MISSION.horizon,
          billing: LIVE.billing,
          targets: TARGETS,
        });
      },
    },
  },
});
