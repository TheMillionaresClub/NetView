# NetView — TON Blockchain Visualizer

**See the invisible connections between wallets. Track money flows. Uncover networks.**

NetView is a Bloomberg-style analytics platform for the [TON blockchain](https://ton.org/), built as a Telegram-native experience. It transforms raw blockchain data into interactive visual maps, letting anyone explore wallet networks, trace transactions, and discover hidden connections — no technical expertise required.

<img width="955" height="999" alt="NetView Dashboard" src="https://github.com/user-attachments/assets/9acc6303-7299-42f7-ba3a-2a6cac9d1ea8" />

---

## What Is NetView?

Imagine being able to see every transaction a wallet has ever made — not as a boring list of numbers, but as a **living, interactive map** of connections. That's NetView.

Think of it like a social network graph, but for money. Each bubble represents a wallet, and the lines between them represent transactions. Bigger bubbles mean more activity. Different colors represent different types of wallets (whales, traders, investors, etc.). You can click on any bubble to dive deeper, expand the network, and follow the money trail.

### Who Is This For?

- **Traders & Investors** — Track whale wallets, see where smart money flows before making decisions
- **Blockchain Analysts** — Investigate transaction patterns, trace fund movements across the network
- **DeFi Users** — Understand the wallets you interact with and assess counterparty risk
- **Curious Explorers** — Anyone who wants to understand how money moves on the TON blockchain
- **Telegram Communities** — Share wallet insights and network visualizations directly

---

## Features

### Interactive Network Visualization

The heart of NetView is its **bubble map** — an interactive graph that shows how wallets are connected through transactions.

- **Visual transaction mapping** — See all counterparties for any wallet as an interactive network of bubbles
- **Smart sizing** — Bubble sizes reflect transaction volume, so the biggest players stand out immediately
- **Color-coded wallet types** — Wallets are automatically classified and color-coded:
  - 🟠 **Center** — The wallet you're currently inspecting
  - 🟣 **Whale** — High-value wallets with significant holdings
  - 🔵 **Trader** — Active wallets with frequent trading patterns
  - 🟢 **Degen** — High-frequency, high-risk interaction patterns
  - 🔵 **Investor** — Long-term holders with steady accumulation
- **Click to expand** — Click any wallet to see its own network and keep exploring
- **Export as image** — Save any visualization as a screenshot to share

### Wallet Profiling

Get a comprehensive profile of any TON wallet address, including:

- **Balance & State** — Current TON balance and wallet status
- **Token Holdings (Jettons)** — All fungible tokens held by the wallet (like ERC-20 tokens on Ethereum)
- **NFT Collection** — All NFTs owned, with images and metadata
- **DNS Names** — Any TON DNS names associated with the wallet (like ENS on Ethereum)
- **Transaction History** — Full history with action types (transfers, swaps, staking, etc.)
- **Wallet Classification** — Automatic categorization based on on-chain behavior
- **Counterparty List** — Every wallet this address has interacted with, ranked by volume

### Connection Tracing

Ever wondered if two wallets are connected? NetView's **trace feature** finds the shortest path between any two wallets on the TON network.

- **Bidirectional search** — Searches from both wallets simultaneously for maximum speed
- **Live progress tracking** — Watch the search happen in real-time with node counts, queue depth, and elapsed time
- **Path visualization** — See the exact chain of wallets connecting your two targets
- **Configurable depth** — Control how deep the search goes (default: 3 hops)

### Transaction Analysis

Go beyond simple transaction lists:

- **Bulk fetching** — Load up to 10,000 transactions at once for deep analysis
- **Real-time streaming** — Watch new transactions as they happen via live data streams
- **Flow aggregation** — See net flows between wallets (total sent vs. total received)
- **Multi-asset tracking** — Supports both native TON transfers and Jetton token transfers

### Network Analytics Dashboard

A bird's-eye view of network activity:

- **Top wallets by volume** — See who's moving the most money
- **Token flow tracking** — Follow specific tokens across the network
- **Risk alerts** — Automated alerts for suspicious patterns, with severity levels
- **Time-series data** — 24-hour volume, active addresses, and trend analysis

### Pay-Per-Query with Crypto (x402 Protocol)

NetView implements the **x402 payment protocol** — a system where premium API access is paid for directly with cryptocurrency, with no subscriptions or credit cards needed.

- **Seamless wallet payments** — Connect your TON wallet and pay per request
- **Instant settlement** — Payments are verified and settled on-chain automatically
- **Jetton support** — Pay with TON or supported tokens
- **Transparent pricing** — See costs upfront before every request

---

## How It Works (Non-Technical Overview)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                  │     │                  │     │                  │
│   You (Browser   │────▶│   NetView API    │────▶│  TON Blockchain  │
│   or Telegram)   │◀────│   Server         │◀────│  (Toncenter)     │
│                  │     │                  │     │                  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **You enter a wallet address** in the search bar or click on a wallet in the graph
2. **NetView fetches the data** from the TON blockchain via Toncenter API
3. **High-performance Rust code** processes the data — analyzing transactions, finding connections, building network graphs
4. **The frontend displays** beautiful, interactive visualizations in your browser
5. **You explore freely** — click wallets, trace connections, export images, and share insights

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
NEXT_PUBLIC_APP_URL=https://ayesha-acrotic-gingerly.ngrok-free.dev
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
| **Frontend** | Next.js 15, React 19, Tailwind CSS | Web interface & styling |
| **Visualization** | React Flow (@xyflow/react) | Interactive network graphs |
| **Wallet Connection** | TonConnect UI | Connect TON wallets (Tonkeeper, etc.) |
| **Backend** | Express.js, TypeScript | API server & data processing |
| **High-Performance Core** | Rust, WebAssembly (WASM) | Graph traversal & wallet analysis |
| **Blockchain Data** | Toncenter API | On-chain data fetching |
| **Payment Protocol** | x402 (HTTP 402) | Crypto-native pay-per-query |
| **Monorepo** | pnpm workspaces | Multi-package management |

---

## API Reference

All endpoints are served from the API server (default: `https://ayesha-acrotic-gingerly.ngrok-free.dev`).

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
