# NetView — TON Blockchain Intelligence Platform

**See the invisible connections between wallets. Track money flows. Uncover networks.**

NetView is a Bloomberg-style analytics platform for the [TON blockchain](https://ton.org/), built as a Telegram-native experience. It transforms raw blockchain data into interactive visual maps, comprehensive analytics dashboards, and intelligent wallet profiling — letting anyone explore wallet networks, trace transactions, and discover hidden connections with zero technical expertise required.

<img width="955" height="999" alt="NetView Dashboard" src="https://github.com/user-attachments/assets/9acc6303-7299-42f7-ba3a-2a6cac9d1ea8" />

---

## What Is NetView?

Imagine having X-ray vision for blockchain transactions — not as boring lists of numbers, but as **living, interactive visualizations** of how money flows across the TON network. That's NetView.

Think of it like a social network graph, but for money. Each bubble represents a wallet, and the lines between them represent transactions. Bigger bubbles mean more activity. Different colors represent different types of wallets (whales, traders, investors, bots, etc.). You can click any bubble to dive deeper, expand the network, trace connections between any two wallets, and follow the money trail in real-time.

### Who Is This For?

- **Traders & Investors** — Track whale wallets, monitor smart money flows, analyze token distributions before making decisions
- **Blockchain Analysts** — Investigate transaction patterns, trace fund movements, identify bot networks and suspicious activity
- **DeFi Users** — Understand counterparty risk, verify wallet legitimacy, assess protocol interactions
- **Security Researchers** — Detect fraud patterns, track stolen funds, analyze attack vectors
- **Developers & Integrators** — Build on top of NetView's APIs, integrate wallet intelligence into your dApps
- **Curious Explorers** — Anyone who wants to understand how money moves on the TON blockchain
- **Telegram Communities** — Share wallet insights and network visualizations directly in chats

---

## Features

### 🗺️ Interactive Network Visualization

The heart of NetView is its **bubble map** — an interactive graph that shows how wallets are connected through transactions.

- **Visual transaction mapping** — See all counterparties for any wallet as an interactive network of bubbles
- **Smart sizing** — Bubble sizes reflect transaction volume, so the biggest players stand out immediately
- **Color-coded wallet types** — Wallets are automatically classified and color-coded:
  - 🟠 **Center** — The wallet you're currently inspecting
  - 🟣 **Whale** — High-value wallets with significant holdings (>10,000 TON)
  - 🔵 **Trader** — Active wallets with frequent trading patterns
  - 🟢 **Degen** — High-frequency, high-risk interaction patterns
  - 💼 **Investor** — Long-term holders with steady accumulation
  - 🤖 **Bot** — Automated wallets with programmatic behavior (80%+ confidence)
- **Click to expand** — Click any wallet to see its own network and keep exploring
- **Export as image** — Save any visualization as a screenshot to share (HTML-to-image export)
- **Zoom & pan controls** — Navigate large networks smoothly with touch and mouse support

### 👤 Wallet Profiling

Get a comprehensive profile of any TON wallet address with AI-powered classification:

- **Balance & State** — Current TON balance (nano units + formatted), wallet status (active/uninitialized/frozen)
- **Token Holdings (Jettons)** — All fungible tokens held with balances, decimals, images, and USD values
- **NFT Collection** — All NFTs owned with images, metadata, and collection details (up to 8 shown)
- **DNS Names** — TON DNS domains associated with the wallet (like ENS on Ethereum)
- **Transaction History** — Full activity log with action types:
  - 📤 **Transfers** (sent/received)
  - 🔄 **Swaps** (DEX trades)
  - 🥩 **Staking** (validator staking)
  - 💰 **Jetton Transfers** (token movements)
  - 📝 **Smart Contract Calls**
- **Wallet Classification** — Automatic categorization based on on-chain behavior patterns with confidence scores
- **Counterparty Analysis** — Every wallet this address has interacted with, ranked by total volume
- **Transaction Flow Summary** — Total sent vs. received, net flow, total fees paid
- **First/Last Activity** — Account age and recency metrics

### 🔗 Connection Tracing

![Wallet Connection Finder](https://via.placeholder.com/1000x600/1a1d29/00d4ff?text=Trace+Feature)

Ever wondered if two wallets are connected? NetView's **trace feature** finds the shortest path between any two wallets on the TON network using a high-performance bidirectional search algorithm.

- **Bidirectional search** — Searches from both wallets simultaneously for maximum speed (up to 10,000x faster than unidirectional)
- **Live progress tracking** — Watch the search happen in real-time:
  - Nodes explored count
  - Current queue depths (queue_a, queue_b)
  - Elapsed time (milliseconds)
  - Real-time search status
- **Path visualization** — Interactive graph showing the exact chain of wallets and transactions:
  - Transaction hashes for each hop
  - Transfer amounts at each step
  - Logical time (lt) for transaction ordering
  - Visual START → intermediate nodes → END path
- **Configurable depth** — Control how deep the search goes (2-5 hops, default: 3)
- **Cost transparency** — Payment calculated as `2^depth × 0.01 TON` (e.g., depth 3 = 0.08 TON)
- **Results table** — Full hop-by-hop breakdown with wallet addresses, balances, and transaction details

### 📊 Transaction Analysis

![Transaction List Viewer](https://via.placeholder.com/1000x600/1a1d29/00d4ff?text=Transaction+Page)

Go beyond simple transaction lists with powerful filtering and bulk analysis:

- **Bulk fetching** — Load up to 10,000 transactions at once for deep analysis
- **Real-time streaming** — Watch new transactions as they happen via Server-Sent Events (SSE)
- **Advanced filtering:**
  - By action (ALL / SEND / RECEIVE)
  - By transaction type (transfers, jettons, DEX, staking)
  - By date range
- **Sorting options:**
  - Timestamp (newest/oldest first)
  - Amount (high to low / low to high)
  - Fee (high to low / low to high)
  - Action type
- **Flow aggregation** — See net flows between wallets (total sent vs. total received)
- **Multi-asset tracking** — Supports both native TON transfers and Jetton token transfers
- **Payment integration** — Bulk fetch (>100 txs) costs 0.02 TON, standard fetch costs 0.01 TON
- **Performance metrics** — Duration tracking shows fetch time for transparency

### 📈 Network Analytics Dashboard

![Analytics Dashboard](https://via.placeholder.com/1000x600/1a1d29/00d4ff?text=Analytics+Dashboard)

A bird's-eye view of the entire TON network with live market data and blockchain metrics:

**Network Statistics:**
- **TON Price** — Live price in USD with 24h change percentage
- **Market Cap** — Total market capitalization
- **24h Volume** — Trading volume across all exchanges
- **TPS (Transactions Per Second)** — Network throughput metric
- **Validators** — Current validator count
- **Total Stake** — Total TON staked (e.g., 450.5M TON)
- **Latest Block** — Current block height (e.g., #58,616,578)
- **Active Wallets** — Number of active addresses on the network

**Market Data (CoinGecko Integration):**
- Circulating supply
- Total supply
- Fully Diluted Valuation (FDV)
- 24h price high/low
- Price change percentages

**DEX Overview:**
- **Total TVL** — Total value locked across all DEXes
- **24h Volume** — DEX trading volume
- **Top DEXes** — STON.FI and DEDUST with individual TVL and volume stats

**Live Updates:**
- Real-time data with "LIVE" indicator
- Last updated timestamp ("UPDATED 0S AGO")
- Auto-refresh capabilities

### 💳 Pay-Per-Query with Crypto (x402 Protocol)

NetView implements the **x402 payment protocol** — a revolutionary system where premium API access is paid for directly with cryptocurrency, with no subscriptions, credit cards, or traditional payment processors.

**How It Works:**
1. **Connect Wallet** — Use TonConnect to link your TON wallet (Tonkeeper, MyTonWallet, etc.)
2. **Request Premium Data** — Click "FETCH" or "FIND CONNECTION" on any premium feature
3. **Review Payment** — See the cost upfront (e.g., "FETCH - 0.02 TON" or "FIND CONNECTION - 0.04 TON")
4. **One-Click Payment** — Approve the transaction in your wallet
5. **Instant Access** — Data loads immediately after blockchain confirmation

**Payment Features:**
- **Seamless wallet payments** — No forms, no accounts, no credit cards
- **Instant on-chain settlement** — Payments verified and settled automatically via blockchain
- **Jetton support** — Pay with native TON or supported tokens (e.g., BSA token)
- **Transparent pricing** — All costs shown upfront before every request:
  - Wallet analysis: 0.02 TON
  - Bulk transactions (200+): 0.02 TON
  - Connection tracing: `2^depth × 0.01 TON` (depth 3 = 0.08 TON)
- **Network-aware** — Works on both testnet and mainnet
- **Payment status tracking** — Real-time payment confirmation with "PAID" indicators

---

## How It Works (Non-Technical Overview)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                  │     │                  │     │                  │     │                  │
│   You (Browser   │────▶│   NetView API    │────▶│   Rust WASM      │────▶│  TON Blockchain  │
│   or Telegram)   │◀────│   Server         │◀────│   Analyzer       │◀────│  (Toncenter)     │
│                  │     │                  │     │                  │     │                  │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │
       │                        │
       │                ┌───────▼────────┐
       └───────────────▶│  x402 Payment  │
                        │  Facilitator   │
                        └────────────────┘
```

1. **You enter a wallet address** in the search bar or click on a wallet in the graph
2. **NetView fetches the data** from the TON blockchain via Toncenter API
3. **High-performance Rust code** (compiled to WebAssembly) processes the data — analyzing transactions, finding connections, building network graphs with sub-second response times
4. **Payment middleware** intercepts premium requests, returns HTTP 402 Payment Required with payment details
5. **TonConnect UI** handles wallet signatures and payment broadcasts to the blockchain
6. **x402 facilitator** verifies payments and grants access to premium data
7. **The frontend displays** beautiful, interactive visualizations in your browser
8. **You explore freely** — click wallets, trace connections, export images, and share insights

### Architecture Highlights

- **Monorepo Structure** — All packages managed with pnpm workspaces for seamless development
- **Rust + WASM** — Performance-critical code (wallet analysis, graph traversal) runs at near-native speeds
- **Blockchain-Native Payments** — No payment processors, no credit cards — just wallet-to-wallet TON transfers
- **Streaming APIs** — Real-time data delivery via Server-Sent Events (SSE) for live analytics
- **Modular Design** — Independent packages (@ton-x402/core, client, middleware) for easy integration into other projects

---

## Screenshots

### Analytics Dashboard
*Real-time TON network metrics, market data from CoinGecko, and DEX statistics*

![Analytics Dashboard - Overview Tab](.media/analytics-dashboard.png)

The Analytics page provides a comprehensive overview of the TON ecosystem:
- Live network stats (TPS: 0.6, Validators: 365, Total Stake: 450.5M TON, Latest Block: #58,616,578)
- Market data (TON Price: $1.27 +1.7%, Market Cap: $3.1B, 24h Volume: $74.6M)
- Market fundamentals (Circulating Supply: 2.5B TON, Total Supply: 5.2B TON, FDV: $6.5B)
- DEX statistics (Total TVL: $26.4M, 24h Volume: $3.0B)
- Top DEXes: STON.FI (TVL $24.7M / Vol $3.0B) and DEDUST (TVL $1.7M / Vol $112.6K)
- Multiple tabs: OVERVIEW / BLOCKS / TXNS / JETTONS / DEX

### Connection Tracing
*Find the shortest path between any two wallets with live search progress*

![Connection Finder - Live Search](.media/connection-trace.png)

The Trace page helps you discover hidden connections:
- Input two wallet addresses (Wallet A and Wallet B) with swap button
- Set search depth (2-5 hops, cost: `2^depth × 0.01 TON`)
- Watch live progress (2 hops, 2 nodes explored, 103ms in this example)
- Visualize the connection path with interactive ReactFlow graph
- See transaction flow: START (orange) → intermediate nodes (cyan) → END (purple)
- Transaction amounts shown at each hop (e.g., 0.0010 TON)
- Full path table shows: Hop number, Wallet address, Balance, TX Hash, and Transfer amount

### Wallet Detail Panel
*Deep dive into any wallet with comprehensive profiling*

![Wallet Profile - Bot Detection](.media/wallet-detail.png)

The Wallet detail panel shows everything about an address:
- Classification badge: "BOT WALLET - 80%" with confidence score
- Transaction flow summary: "SENT TO THIS WALLET: 0.002 TON" (8 txs, bal: 0.000 TON)
- "RECEIVED FROM THIS WALLET: 0.004 TON" (green, showing net positive flow)
- Wallet info: Address (0:b111...68e7), Balance (42.4K TON), Status (active - wallet v5 r1), Transactions (8), Last Seen (37d ago)
- "Expand Network" button to visualize all wallet connections in bubble map
- Transaction flow visualization (right panel) showing OUT transactions:
  - Each transaction with amount (-0.000 TON), timestamp (37d ago), and transaction ID
  - Multiple outbound transactions visible (to addresses like EQDcb6, EQAfwO, EQCCss, EQCUEs, EQB4SY, etc.)
  - Transaction metadata: 2 txs per entry with balance (e.g., bal: 0.000 TON)
- Jetton Holdings section: 11 tokens (including #1 AIOTX with image)
- "VIEW ON EXPLORER" button for external verification

---

## Getting Started

### Prerequisites

Before you begin, make sure you have these installed on your computer:

| Tool | Version | What It Is | How to Get It |
|------|---------|------------|---------------|
| **Node.js** | 18 or higher | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 8 or higher | Package manager | Run `npm install -g pnpm` after installing Node.js |
| **Rust** | Latest stable | For compiling high-performance modules | [rustup.rs](https://rustup.rs/) |
| **wasm-pack** | Latest | Compiles Rust to WebAssembly | Run `cargo install wasm-pack` after installing Rust |

### Step-by-Step Installation

**1. Clone the repository**

```bash
git clone https://github.com/TheMillionaresClub/NetView.git
cd NetView
```

**2. Install all dependencies**

```bash
pnpm install
```

This installs dependencies for the frontend, API server, and all shared libraries at once.

**3. Build the Rust modules**

```bash
cd rust/wallet-info && wasm-pack build --target nodejs && cd ../..
cd rust/wallet-connection && wasm-pack build --target nodejs && cd ../..
```

This compiles the high-performance Rust code into WebAssembly modules that the API server uses.

**4. Set up environment variables**

Create a `.env` file in the `api/` folder:

```bash
cp api/.env.example api/.env
```

Then edit `api/.env` with your settings:

```env
# Which TON network to use (testnet for testing, mainnet for real data)
TON_NETWORK=testnet

# Your Toncenter API key (get one at https://toncenter.com/)
RPC_API_KEY=your_api_key_here

# API server port
PORT=3001
```

Create a `.env.local` file in the `frontend/` folder:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**5. Start the development servers**

Open two terminal windows:

*Terminal 1 — Start the API server:*
```bash
pnpm dev:api
```

*Terminal 2 — Start the frontend:*
```bash
pnpm dev:frontend
```

**6. Open the app**

Visit **http://localhost:3000** in your browser. You're ready to explore!

---

## Project Structure

For contributors and developers, here's how the codebase is organized:

```
NetView/
│
├── frontend/                  → Web interface (Next.js 15 + React 19)
│   ├── app/
│   │   ├── page.tsx              Main dashboard with network graph
│   │   ├── trace/                Connection tracing between wallets
│   │   ├── transactions/         Transaction history viewer
│   │   ├── analytics/            Network analytics dashboard
│   │   ├── wallet/               Wallet search & detail pages
│   │   └── components/
│   │       ├── BubbleMap.tsx      Interactive network visualization
│   │       ├── DetailPanel.tsx    Wallet profile & counterparty details
│   │       ├── TopNavBar.tsx      Header with wallet connect & search
│   │       └── SideNavBar.tsx     Navigation menu
│   └── ...
│
├── api/                       → Backend server (Express.js)
│   └── src/
│       ├── index.ts              Server entry point
│       ├── routes/               API endpoints
│       │   ├── wallet-info.ts       Wallet balance & state
│       │   ├── wallet-network.ts    Transaction network graph
│       │   ├── wallet-analysis.ts   Full wallet profiling
│       │   ├── wallet-transactions.ts  Transaction history
│       │   ├── wallet-connection.ts    Connection finder (WASM)
│       │   └── trace-link.ts        Connection tracing
│       └── lib/
│           ├── ton-api.ts        Toncenter API wrapper
│           └── wasm-loader.ts    WASM module loader
│
├── rust/                      → High-performance analysis modules (Rust → WASM)
│   ├── wallet-info/              On-chain wallet analysis
│   │   └── src/
│   │       ├── lib.rs            Public API
│   │       └── analysis/         Profiling & classification logic
│   └── wallet-connection/        Graph traversal engine
│       └── src/
│           ├── lib.rs            Public API
│           └── traversal.rs      Bidirectional BFS algorithm
│
├── packages/                  → Shared libraries (x402 payment protocol)
│   ├── core/                     Types & utilities
│   ├── client/                   Payment-enabled HTTP client
│   ├── middleware/                Payment gate for API routes
│   ├── facilitator/              Payment verification & settlement
│   ├── wallet-info/              WASM bindings (wallet analysis)
│   └── wallet-connection/        WASM bindings (connection finder)
│
└── examples/                  → Example implementations
    ├── nextjs-server/            Example payment-gated server
    └── client-script/            Example payment client
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7 | Modern web framework with App Router |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **Visualization** | @xyflow/react 12 (React Flow) | Interactive network graphs & flow diagrams |
| **Wallet Connection** | TonConnect UI 2.4 | Connect TON wallets (Tonkeeper, MyTonWallet, etc.) |
| **Backend** | Express 4.21, TypeScript | REST API server & data aggregation |
| **High-Performance Core** | Rust, WebAssembly (WASM) | Graph traversal, wallet analysis, network statistics |
| **Blockchain Data** | Toncenter API | On-chain data fetching (transactions, blocks, state) |
| **TON SDK** | @ton/ton, @ton/core, @ton/crypto | TON blockchain interaction libraries |
| **Payment Protocol** | x402 (HTTP 402 Payment Required) | Crypto-native pay-per-query system |
| **Monorepo** | pnpm workspaces | Multi-package dependency management |
| **Asset Metadata** | @ton-community/assets-sdk | Token logos, names, and metadata |

### Rust WASM Modules

NetView leverages Rust compiled to WebAssembly for performance-critical operations:

- **wallet-info** — Wallet data extraction and balance analysis
- **wallet-scraper** — Deep wallet profiling with transaction pattern analysis
- **ton-stats** — Network statistics aggregation (TPS, validators, blocks)
- **wallet-connection** — Bidirectional graph traversal for connection finding

These modules provide 10-100x performance improvements over pure JavaScript implementations.

---

## API Reference

All endpoints are served from the API server (default: `http://localhost:3001`).

### Wallet Information

| Endpoint | Description |
|----------|-------------|
| `GET /api/wallet-info?address=...` | Get wallet balance and state |
| `GET /api/wallet-analysis?address=...&network=testnet` | Full wallet profile (balance, tokens, NFTs, classification) |
| `GET /api/wallet-analysis/full?address=...` | Profile + counterparty balances |
| `GET /api/normalize-address?address=...` | Convert address to standard format |

### Transactions

| Endpoint | Description |
|----------|-------------|
| `GET /api/wallet-transactions?address=...&limit=100` | Paginated transaction history |
| `GET /api/wallet-transactions/bulk?address=...&limit=10000` | Bulk fetch (up to 10K) |
| `GET /api/wallet-transactions/stream?address=...` | Real-time streaming (SSE) |

### Network & Connections

| Endpoint | Description |
|----------|-------------|
| `GET /api/wallet-network?address=...&limit=50` | Counterparty flow graph |
| `GET /api/trace-link?master=...&target=...&maxDepth=3` | Find connection path |
| `POST /api/wallet-connection` | Bidirectional connection finder |
| `GET /api/wallet-connection/stream?wallet_a=...&wallet_b=...` | Live connection search (SSE) |

---

## Usage Examples

### 1. Explore a Wallet Network

Navigate to the home page and search for any wallet:

```
1. Enter wallet address in search bar: 0QBbtZtF0cYG5xj7...
2. Click "Load Wallet" or press Enter
3. Interactive bubble map appears showing all counterparties
4. Bubble sizes represent transaction volume
5. Colors indicate wallet type (whale/trader/bot/investor)
6. Click any bubble to expand that wallet's network
7. Click "Export" button to save visualization as PNG
```

### 2. Trace Connection Between Wallets

Find if and how two wallets are connected:

```
1. Navigate to /trace page
2. Enter Wallet A: kQBvFIVmXrgyihekdmKK4CPjnx5d4Bt-_FC_VREY-r01...
3. Enter Wallet B: 0QCjhpqnS02zd-WRV3nvyorizm8t0nAhh7UEXtWYYEq...
4. Set search depth: 2 (or higher for deeper searches)
5. Cost shown: "FIND CONNECTION — 0.04 TON" (for depth 2)
6. Click button and approve payment in TonConnect wallet
7. Watch live progress: "2 hops, 2 nodes explored, 103ms"
8. View path visualization with transaction details
9. See full path table with wallet addresses, amounts, and tx hashes
```

### 3. Analyze Transaction History

Deep dive into wallet activity:

```
1. Navigate to /transactions page
2. Enter wallet address: 0QCjhpqnS02zd-WRV3nvyorizm8t0nAhh7UEXtWYYEq...
3. Set transaction limit: 200 (or up to 10,000 for bulk)
4. Click "FETCH - 0.02 TON" for bulk fetch
5. Approve payment (0.01 TON for <100, 0.02 TON for bulk)
6. Filter transactions: ALL / SEND / RECEIVE
7. Sort by: timestamp, amount, fee, or action
8. View detailed breakdown: from/to addresses, amounts, timestamps
9. Check "Showing 199 of 199" counter for pagination info
```

### 4. Check Network Analytics

Monitor the entire TON ecosystem:

```
1. Navigate to /analytics page
2. View Overview tab:
   - TON Price: $1.27 (+1.7%)
   - Market Cap: $3.1B
   - 24h Volume: $74.6M
   - TPS: 0.6
   - Validators: 365
   - Total Stake: 450.5M TON
   - Latest Block: #58,616,578
3. Switch tabs: BLOCKS / TXNS / JETTONS / DEX
4. DEX overview shows:
   - Total TVL: $26.4M
   - 24h Volume: $3.0B
   - Top DEXes: STON.FI ($24.7M TVL) and DEDUST ($1.7M TVL)
5. Market Data section shows CoinGecko stats:
   - Circulating Supply: 2.5B TON
   - Total Supply: 5.2B TON
   - FDV: $6.5B
6. All data auto-refreshes (LIVE indicator shows freshness)
```

### 5. Using the API Programmatically

**Fetch wallet profile (Node.js/TypeScript):**

```typescript
const response = await fetch(
  'http://localhost:3001/api/wallet-analysis?address=0QBbtZtF0cYG5xj7...&network=testnet'
);
const data = await response.json();

if (data.ok) {
  console.log('Balance:', data.result.state.balance);
  console.log('Classification:', data.result.classification);
  // { kind: "Bot", confidence: 0.8 }
  console.log('Jettons:', data.result.jettons.length);
}
```

**Bulk transaction fetch with x402 payment:**

```typescript
import { createPaymentClient } from '@ton-x402/client';
import { TonConnect } from '@tonconnect/sdk';

// Initialize wallet connection
const tonConnect = new TonConnect({ /* config */ });
await tonConnect.connectWallet();

// Create payment-enabled client
const client = createPaymentClient({
  wallet: tonConnect.wallet,
  network: 'testnet'
});

// Fetch with automatic payment handling
const response = await client.fetch(
  'http://localhost:3001/api/wallet-transactions/bulk?address=0QBbtZtF0cYG5xj7...&limit=5000'
);

// Client automatically:
// 1. Detects HTTP 402 response
// 2. Creates payment BOC with signature
// 3. Sends to facilitator for verification
// 4. Broadcasts payment on-chain
// 5. Retries original request with proof

const data = await response.json();
console.log(`Loaded ${data.result.transactions.length} transactions`);
```

**Stream real-time wallet connections:**

```typescript
const eventSource = new EventSource(
  'http://localhost:3001/api/wallet-connection/stream?wallet_a=0QBbt...&wallet_b=0QCjh...&depth=3'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'progress') {
    console.log(`Nodes explored: ${data.nodesExplored}`);
    console.log(`Queue depth A: ${data.queueA}, B: ${data.queueB}`);
  } else if (data.type === 'result') {
    console.log('Connection found!', data.path);
    eventSource.close();
  } else if (data.type === 'error') {
    console.error('Search failed:', data.message);
    eventSource.close();
  }
};
```

---

## Contributing

Contributions are welcome! Whether you're fixing a typo, improving documentation, or adding a new feature — we'd love your help.

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/my-feature`)
3. **Make your changes** and test them locally
4. **Submit a pull request** with a clear description of what you changed and why

---

## License

This project was built for the **BSA TON Hackathon**.

---

<p align="center">
  <b>NetView</b> — Making the TON blockchain transparent, one wallet at a time.
</p>
