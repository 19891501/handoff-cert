import { useId } from "react";
import type { Verdict } from "@/lib/handoff";
import { cn } from "@/lib/utils";

const TONE: Record<Verdict, string> = {
  REPRENABLE: "text-reprenable",
  PARTIEL: "text-partiel",
  CORROMPU: "text-corrompu",
};

export function VerdictStamp({
  verdict,
  className,
}: {
  verdict: Verdict;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const ringId = `ring-${uid}`;
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("size-36", TONE[verdict], className)}
      aria-label={verdict}
    >
      <defs>
        <path
          id={ringId}
          d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"
        />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="2.25" />
      <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.45" />
      <text
        fill="currentColor"
        fontSize="9.5"
        letterSpacing="3.2"
        fontFamily="IBM Plex Sans, sans-serif"
      >
        <textPath href={`#${ringId}`} startOffset="0%">
          HANDOFF CERT · RULESET 1.0 · FAIL-CLOSED ·
        </textPath>
      </text>
      <text
        x="100"
        y="104"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Instrument Serif, serif"
        fontSize={verdict === "REPRENABLE" ? "16" : "18"}
        letterSpacing="1.2"
      >
        {verdict}
      </text>
    </svg>
  );
}

export function VerdictDot({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        verdict === "REPRENABLE" && "bg-reprenable",
        verdict === "PARTIEL" && "bg-partiel",
        verdict === "CORROMPU" && "bg-corrompu",
      )}
      aria-hidden
    />
  );
}
