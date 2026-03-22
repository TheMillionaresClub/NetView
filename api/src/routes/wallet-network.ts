/**
 * wallet-network.ts  —  Returns the on-chain interaction graph for a wallet.
 *
 * GET /api/wallet-network?address=<addr>&limit=50
 *
 * Fetches real transactions via toncenter, extracts all interacted addresses,
 * and returns per-counterparty flow data (sent/received amounts, tx count).
 */

import { Router, type Request, type Response } from "express";
import {
  getTransactions,
  type Tx,
} from "../lib/ton-api.js";

const router = Router();

interface FlowSummary {
  address: string;
  sentNano: number;      // total nanoTON sent TO this address
  receivedNano: number;  // total nanoTON received FROM this address
  txCount: number;       // number of txs involving this address
  lastSeen: number;      // most recent utime
}

interface NetworkResult {
  center: string;
  balanceNano: number | null;
  totalTxFetched: number;
  counterparties: FlowSummary[];
}

router.get("/", async (req: Request, res: Response) => {
  const { address, limit, network } = req.query as Record<string, string>;

  if (!address) {
    return res.status(400).json({ error: "Missing ?address= query parameter" });
  }

  const txLimit = Math.min(Number(limit) || 50, 200);

  try {
    const txs = await getTransactions(address, txLimit, network);

    // Build a flow map per counterparty
    const flows = new Map<string, FlowSummary>();

    const ensureFlow = (addr: string): FlowSummary => {
      if (!flows.has(addr)) {
        flows.set(addr, { address: addr, sentNano: 0, receivedNano: 0, txCount: 0, lastSeen: 0 });
      }
      return flows.get(addr)!;
    };

    for (const tx of txs) {
      // Incoming message
      if (tx.in_msg?.source && tx.in_msg.source !== "" && tx.in_msg.source !== address) {
        const f = ensureFlow(tx.in_msg.source);
        f.receivedNano += Number(tx.in_msg.value ?? 0);
        f.txCount++;
        f.lastSeen = Math.max(f.lastSeen, tx.utime);
      }

      // Outgoing messages
      for (const msg of tx.out_msgs ?? []) {
        if (msg.destination && msg.destination !== "" && msg.destination !== address) {
          const f = ensureFlow(msg.destination);
          f.sentNano += Number(msg.value ?? 0);
          f.txCount++;
          f.lastSeen = Math.max(f.lastSeen, tx.utime);
        }
      }
    }

    // Sort by total volume descending
    const counterparties = Array.from(flows.values())
      .sort((a, b) => (b.sentNano + b.receivedNano) - (a.sentNano + a.receivedNano));

    const result: NetworkResult = {
      center: address,
      balanceNano: null,
      totalTxFetched: txs.length,
      counterparties,
    };

    return res.json({ ok: true, result });
  } catch (err) {
    console.error("wallet-network error:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
