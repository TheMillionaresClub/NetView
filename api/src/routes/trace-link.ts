/**
 * trace-link.ts  —  Bidirectional graph traversal to find common
 *                    interactions between two TON wallets.
 *
 * GET /api/trace-link?master=<addr>&target=<addr>[&maxDepth=3][&txLimit=80]
 *
 * Algorithm:  Bidirectional BFS
 * ─────────────────────────────
 * 1.  Start two frontiers: one from `master`, one from `target`.
 * 2.  At each depth level, expand the SMALLER frontier first
 *     (minimises API calls).
 * 3.  After expanding, check intersection of the two "seen" sets.
 * 4.  Dynamic limit: if the total explored addresses exceeds a
 *     budget, stop early regardless of depth.
 *
 * Returns:
 *   - matches[]       : addresses both wallets interacted with (with depth info)
 *   - masterGraph     : adjacency data for the master side
 *   - targetGraph     : adjacency data for the target side
 *   - stats           : depth reached, addresses explored, API calls, etc.
 */

import { Router, type Request, type Response } from "express";
import {
  getTransactions,
  extractInteractedAddresses,
  type Tx,
} from "../lib/ton-api.js";

const router = Router();

// ─── Types ────────────────────────────────────────────────────────

interface GraphNode {
  address: string;
  depth: number;
  interactsWith: string[]; // direct neighbours found
}

interface Match {
  address: string;
  masterDepth: number; // how many hops from master
  targetDepth: number; // how many hops from target
  totalDistance: number;
}

interface TraceResult {
  master: string;
  target: string;
  network: string;
  matches: Match[];
  masterGraph: Record<string, GraphNode>;
  targetGraph: Record<string, GraphNode>;
  stats: {
    depthReached: number;
    addressesExplored: number;
    apiCalls: number;
    dynamicBudgetUsed: number;
    dynamicBudgetMax: number;
    durationMs: number;
  };
}

// ─── Dynamic budget calculator ────────────────────────────────────
// The idea: dense graphs (many addresses per wallet) get a lower
// depth limit, while sparse wallets can go deeper.

function computeDynamicBudget(
  maxDepth: number,
  txLimitPerAddr: number
): { maxAddresses: number; maxApiCalls: number } {
  // Base budget: how many unique addresses we're willing to explore total
  // Conservative — every address = 1 API call = ~300ms
  const maxAddresses = Math.min(200, maxDepth * 60);
  const maxApiCalls = maxAddresses; // 1:1
  return { maxAddresses, maxApiCalls };
}

// ─── BFS expansion ────────────────────────────────────────────────

async function expandFrontier(
  frontier: Set<string>,
  seen: Map<string, number>, // address → depth it was discovered
  graph: Record<string, GraphNode>,
  depth: number,
  txLimit: number,
  stats: { apiCalls: number }
): Promise<Set<string>> {
  const nextFrontier = new Set<string>();

  for (const addr of frontier) {
    if (graph[addr]) continue; // already expanded

    stats.apiCalls++;
    let txs: Tx[];
    try {
      txs = await getTransactions(addr, txLimit);
    } catch {
      txs = [];
    }

    const neighbours = extractInteractedAddresses(txs, addr);
    graph[addr] = {
      address: addr,
      depth,
      interactsWith: [...neighbours],
    };

    for (const n of neighbours) {
      if (!seen.has(n)) {
        seen.set(n, depth + 1);
        nextFrontier.add(n);
      }
    }
  }

  return nextFrontier;
}

// ─── Route handler ────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const master = req.query.master as string | undefined;
  const target = req.query.target as string | undefined;

  if (!master || !target) {
    return res
      .status(400)
      .json({ error: "Missing ?master=<addr>&target=<addr> query params" });
  }

  if (master === target) {
    return res.json({
      master,
      target,
      matches: [{ address: master, masterDepth: 0, targetDepth: 0, totalDistance: 0 }],
      masterGraph: {},
      targetGraph: {},
      stats: { depthReached: 0, addressesExplored: 0, apiCalls: 0, dynamicBudgetUsed: 0, dynamicBudgetMax: 0, durationMs: 0 },
    });
  }

  const maxDepth = Math.min(Number(req.query.maxDepth) || 3, 5);
  const txLimit = Math.min(Number(req.query.txLimit) || 80, 200);
  const budget = computeDynamicBudget(maxDepth, txLimit);

  const t0 = Date.now();

  // State for master side
  let masterFrontier = new Set([master]);
  const masterSeen = new Map<string, number>([[master, 0]]);
  const masterGraph: Record<string, GraphNode> = {};

  // State for target side
  let targetFrontier = new Set([target]);
  const targetSeen = new Map<string, number>([[target, 0]]);
  const targetGraph: Record<string, GraphNode> = {};

  const stats = { apiCalls: 0 };
  let depthReached = 0;
  const allMatches: Match[] = [];

  // ── Check direct match (master IS target's contact or vice versa)
  // Already handled above (master === target), but they might directly
  // transact with each other — we'll catch that at depth 1.

  for (let d = 0; d < maxDepth; d++) {
    depthReached = d + 1;
    const totalExplored = masterSeen.size + targetSeen.size;

    // Dynamic cutoff: if we've already explored too many addresses, stop
    if (totalExplored >= budget.maxAddresses) {
      console.log(
        `[trace-link] Budget reached: ${totalExplored}/${budget.maxAddresses} addresses at depth ${d}`
      );
      break;
    }
    if (stats.apiCalls >= budget.maxApiCalls) {
      console.log(
        `[trace-link] API call budget reached: ${stats.apiCalls}/${budget.maxApiCalls}`
      );
      break;
    }

    // Expand the smaller frontier first (optimisation)
    const expandMasterFirst = masterFrontier.size <= targetFrontier.size;

    if (expandMasterFirst) {
      masterFrontier = await expandFrontier(
        masterFrontier, masterSeen, masterGraph, d + 1, txLimit, stats
      );
      // Check for matches after master expansion
      findNewMatches(masterSeen, targetSeen, allMatches);

      if (allMatches.length > 0 && d >= 1) break; // found links — early exit

      targetFrontier = await expandFrontier(
        targetFrontier, targetSeen, targetGraph, d + 1, txLimit, stats
      );
    } else {
      targetFrontier = await expandFrontier(
        targetFrontier, targetSeen, targetGraph, d + 1, txLimit, stats
      );
      findNewMatches(masterSeen, targetSeen, allMatches);

      if (allMatches.length > 0 && d >= 1) break;

      masterFrontier = await expandFrontier(
        masterFrontier, masterSeen, masterGraph, d + 1, txLimit, stats
      );
    }

    // Check intersection after both sides expanded
    findNewMatches(masterSeen, targetSeen, allMatches);

    // If we found matches and we're past the first depth, we can stop
    // (continuing would only find longer paths)
    if (allMatches.length > 0) break;
  }

  // Sort matches by total distance (shortest path first)
  allMatches.sort((a, b) => a.totalDistance - b.totalDistance);

  // Remove the master and target themselves from matches
  const filtered = allMatches.filter(
    (m) => m.address !== master && m.address !== target
  );

  const result: TraceResult = {
    master,
    target,
    network: (process.env.TON_NETWORK ?? "testnet").toLowerCase(),
    matches: filtered,
    masterGraph,
    targetGraph,
    stats: {
      depthReached,
      addressesExplored: masterSeen.size + targetSeen.size,
      apiCalls: stats.apiCalls,
      dynamicBudgetUsed: masterSeen.size + targetSeen.size,
      dynamicBudgetMax: budget.maxAddresses,
      durationMs: Date.now() - t0,
    },
  };

  return res.json(result);
});

// ─── Helper: find addresses that appear in both seen-sets ─────────

function findNewMatches(
  masterSeen: Map<string, number>,
  targetSeen: Map<string, number>,
  existing: Match[]
): void {
  const existingAddrs = new Set(existing.map((m) => m.address));

  // Iterate the smaller set for efficiency
  const [smaller, larger, isSmMaster] =
    masterSeen.size <= targetSeen.size
      ? [masterSeen, targetSeen, true]
      : [targetSeen, masterSeen, false];

  for (const [addr, depthInSmaller] of smaller) {
    if (existingAddrs.has(addr)) continue;
    const depthInLarger = larger.get(addr);
    if (depthInLarger !== undefined) {
      const mDepth = isSmMaster ? depthInSmaller : depthInLarger;
      const tDepth = isSmMaster ? depthInLarger : depthInSmaller;
      existing.push({
        address: addr,
        masterDepth: mDepth,
        targetDepth: tDepth,
        totalDistance: mDepth + tDepth,
      });
    }
  }
}

export default router;
