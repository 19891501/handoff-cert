import { flattenTree, type Mmr, type TreeNode } from "@/lib/merkle/mmr";
import { cn } from "@/lib/utils";

const SLOT = 56;
const LEVEL = 52;
const R = 14;

function short(hash: string) {
  return hash.slice(0, 4);
}

function nodeX(node: TreeNode) {
  return (node.firstLeaf + node.size / 2) * SLOT;
}

function nodeY(node: TreeNode, maxH: number) {
  return (maxH - node.height) * LEVEL + 28;
}

export function Mountain({
  mmr,
  selected,
  onSelect,
}: {
  mmr: Mmr;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const n = mmr.leaves.length;
  if (n === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-card text-sm text-muted-foreground shadow-[var(--shadow-border)]">
        Aucune feuille. Le lot n'est pas ouvert.
      </div>
    );
  }

  const maxH = Math.max(...mmr.forest.map((p) => p.height), 0);
  const width = Math.max(n * SLOT + SLOT, 320);
  const height = (maxH + 1) * LEVEL + 64;
  const nodes = mmr.forest.flatMap(flattenTree);

  return (
    <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="Montagne de Merkle incrémentale"
        className="mx-auto text-foreground"
      >
        {nodes.map((node) => {
          if (!node.left || !node.right) return null;
          const x = nodeX(node);
          const y = nodeY(node, maxH);
          return (
            <g key={`e-${node.hash}-${node.firstLeaf}`}>
              <line
                x1={x}
                y1={y}
                x2={nodeX(node.left)}
                y2={nodeY(node.left, maxH)}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />
              <line
                x1={x}
                y1={y}
                x2={nodeX(node.right)}
                y2={nodeY(node.right, maxH)}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />
            </g>
          );
        })}
        {nodes.map((node) => {
          const x = nodeX(node);
          const y = nodeY(node, maxH);
          const isLeaf = node.height === 0;
          const isPeak = mmr.peaks.some((p) => p.hash === node.hash && p.firstLeaf === node.firstLeaf);
          const touched = mmr.touched.has(node.hash);
          const isSelected = isLeaf && selected === node.firstLeaf;
          return (
            <g key={`n-${node.hash}-${node.firstLeaf}`}>
              {isLeaf ? (
                <g
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onSelect(node.firstLeaf)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(node.firstLeaf);
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={R}
                    className={cn(
                      isSelected
                        ? "fill-accent"
                        : touched
                          ? "fill-reprenable/40"
                          : "fill-muted",
                    )}
                    stroke="currentColor"
                    strokeWidth={isPeak ? 1.6 : 1}
                  />
                </g>
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={R}
                  className={cn(touched ? "fill-reprenable/40" : "fill-muted")}
                  stroke="currentColor"
                  strokeWidth={isPeak ? 1.6 : 1}
                />
              )}
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  "font-mono",
                  isSelected ? "fill-accent-foreground" : "fill-foreground",
                )}
                fontSize="8"
              >
                {short(node.hash)}
              </text>
              {isPeak ? (
                <text
                  x={x}
                  y={y - R - 8}
                  textAnchor="middle"
                  className="fill-subtle font-mono"
                  fontSize="8"
                >
                  pic {node.height}
                </text>
              ) : null}
              {isLeaf ? (
                <text
                  x={x}
                  y={y + R + 12}
                  textAnchor="middle"
                  className="fill-subtle font-mono"
                  fontSize="8"
                >
                  {node.firstLeaf}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
