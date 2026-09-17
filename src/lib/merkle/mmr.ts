import { sha256Hex } from "@/lib/handoff/hash";

export const ZERO = "0".repeat(64);
export const DEMO_BATCH = 16;
export const CONTRAT_BATCH = 500;

export const CONTRAT = {
  id: "handoff-cert-v1",
  unit: "certificate",
  demo_batch: DEMO_BATCH,
  batch_size: CONTRAT_BATCH,
  currency: "USDC",
  network: "base",
} as const;

export async function pair(left: string, right: string): Promise<string> {
  return sha256Hex(`mmr:node:${left}:${right}`);
}

export async function bagPeaks(peaks: string[]): Promise<string> {
  if (peaks.length === 0) return ZERO;
  let acc = peaks[0]!;
  for (let i = 1; i < peaks.length; i++) {
    acc = await pair(acc, peaks[i]!);
  }
  return acc;
}

export interface Peak {
  hash: string;
  height: number;
  size: number;
  firstLeaf: number;
}

export interface TreeNode {
  hash: string;
  height: number;
  firstLeaf: number;
  size: number;
  left?: TreeNode;
  right?: TreeNode;
}

export interface Sibling {
  hash: string;
  side: "left" | "right";
}

export interface InclusionProof {
  leafIndex: number;
  leafHash: string;
  siblings: Sibling[];
  peakHashes: string[];
  peakIndex: number;
}

export interface Mmr {
  leaves: string[];
  peaks: Peak[];
  forest: TreeNode[];
  root: string;
  hashesThisStep: number;
  hashesCumulative: number;
  touched: Set<string>;
}

export function emptyMmr(): Mmr {
  return {
    leaves: [],
    peaks: [],
    forest: [],
    root: ZERO,
    hashesThisStep: 0,
    hashesCumulative: 0,
    touched: new Set(),
  };
}

export function peakSizes(n: number): number[] {
  const sizes: number[] = [];
  for (let bit = 31; bit >= 0; bit--) {
    const size = 1 << bit;
    if (n & size) sizes.push(size);
  }
  return sizes;
}

export function hashesNaive(n: number): number {
  if (n <= 1) return n === 1 ? 0 : 0;
  const padded = 1 << Math.ceil(Math.log2(n));
  return padded - 1;
}

async function join(left: TreeNode, right: TreeNode, count: { n: number; touched: string[] }): Promise<TreeNode> {
  const hash = await pair(left.hash, right.hash);
  count.n += 1;
  count.touched.push(hash);
  return {
    hash,
    height: left.height + 1,
    firstLeaf: left.firstLeaf,
    size: left.size + right.size,
    left,
    right,
  };
}

export async function appendLeaf(mmr: Mmr, leafHash: string): Promise<Mmr> {
  const count = { n: 0, touched: [leafHash] };
  const leaf: TreeNode = {
    hash: leafHash,
    height: 0,
    firstLeaf: mmr.leaves.length,
    size: 1,
  };
  const stack = [...mmr.forest, leaf];
  while (stack.length >= 2) {
    const a = stack[stack.length - 2]!;
    const b = stack[stack.length - 1]!;
    if (a.height !== b.height) break;
    stack.pop();
    stack.pop();
    stack.push(await join(a, b, count));
  }
  const peaks: Peak[] = stack.map((node) => ({
    hash: node.hash,
    height: node.height,
    size: node.size,
    firstLeaf: node.firstLeaf,
  }));
  const root = await bagPeaks(peaks.map((p) => p.hash));
  if (peaks.length > 1) count.n += peaks.length - 1;
  return {
    leaves: [...mmr.leaves, leafHash],
    peaks,
    forest: stack,
    root,
    hashesThisStep: count.n,
    hashesCumulative: mmr.hashesCumulative + count.n,
    touched: new Set(count.touched),
  };
}

function pathToPeak(node: TreeNode, leafIndex: number, siblings: Sibling[]): boolean {
  if (node.height === 0) return node.firstLeaf === leafIndex;
  if (!node.left || !node.right) return false;
  if (pathToPeak(node.left, leafIndex, siblings)) {
    siblings.push({ hash: node.right.hash, side: "right" });
    return true;
  }
  if (pathToPeak(node.right, leafIndex, siblings)) {
    siblings.push({ hash: node.left.hash, side: "left" });
    return true;
  }
  return false;
}

export function prove(mmr: Mmr, leafIndex: number): InclusionProof | null {
  if (leafIndex < 0 || leafIndex >= mmr.leaves.length) return null;
  const peakIndex = mmr.forest.findIndex((node) => {
    const last = node.firstLeaf + node.size - 1;
    return leafIndex >= node.firstLeaf && leafIndex <= last;
  });
  if (peakIndex < 0) return null;
  const peak = mmr.forest[peakIndex]!;
  const siblings: Sibling[] = [];
  if (!pathToPeak(peak, leafIndex, siblings)) return null;
  return {
    leafIndex,
    leafHash: mmr.leaves[leafIndex]!,
    siblings,
    peakHashes: mmr.peaks.map((p) => p.hash),
    peakIndex,
  };
}

export async function verifyProof(proof: InclusionProof, root: string): Promise<boolean> {
  let hash = proof.leafHash;
  for (const sib of proof.siblings) {
    hash = sib.side === "right" ? await pair(hash, sib.hash) : await pair(sib.hash, hash);
  }
  if (hash !== proof.peakHashes[proof.peakIndex]) return false;
  const bagged = await bagPeaks(proof.peakHashes);
  return bagged === root;
}

export async function climb(leafHash: string, siblings: Sibling[]): Promise<string> {
  let hash = leafHash;
  for (const sib of siblings) {
    hash = sib.side === "right" ? await pair(hash, sib.hash) : await pair(sib.hash, hash);
  }
  return hash;
}

export function flattenTree(node: TreeNode): TreeNode[] {
  const out: TreeNode[] = [node];
  if (node.left) out.push(...flattenTree(node.left));
  if (node.right) out.push(...flattenTree(node.right));
  return out;
}
