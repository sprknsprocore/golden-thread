# Golden Thread — Production Management Prototype

A high-fidelity prototype demonstrating the "Golden Thread" workflow: bridging granular estimating assemblies with real-time field productivity tracking and PM reconciliation.

## The Problem

Construction is losing veteran supervisors who can intuitively sense project delays. This prototype scales that intuition by creating a closed-loop system where data flows seamlessly from bid to closeout. See [`docs/01_Problem_Definition.md`](docs/01_Problem_Definition.md) for full context.

## Workflow Phases

| Phase | Page | Description |
|-------|------|-------------|
| **Dashboard** | `/` | Project overview with KPIs and navigation |
| **A: Setup** | `/setup` | Map assemblies to WBS codes, set production targets |
| **B: Capture** | `/capture` | Unified field entry for labor, equipment, and units |
| **C: True-Up** | `/reconciliation` | PM reconciliation with performance signals |
| **Closeout** | `/closeout` | Push final rates to estimating database |

## Tech Stack

- **Next.js 14+** (App Router) with TypeScript
- **shadcn/ui** + Tailwind CSS
- **@tanstack/react-table** for data grids
- **Zustand** for state management
- Mock data seeded from `src/data/golden_thread_data.json`

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Dashboard
│   ├── setup/              # Phase A: Baseline setup
│   ├── capture/            # Phase B: Unified field capture
│   ├── reconciliation/     # Phase C: PM True-Up
│   └── closeout/           # Feedback loop
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── assembly-picker.tsx # Multi-tier code picker
│   ├── unified-grid.tsx    # Main foreman entry grid
│   ├── claiming-sub-grid.tsx
│   ├── material-drawdown.tsx
│   ├── reconciliation-table.tsx
│   ├── reverse-calculator.tsx
│   └── closeout-panel.tsx
├── store/                  # Zustand state management
├── lib/                    # Calculation logic
└── data/                   # Mock seed data
docs/                       # Project documentation
```

## Documentation

- [Problem Definition](docs/01_Problem_Definition.md)
- [Workflow Definition](docs/02_Workflow_Definition.md)
- [Solution Architecture](docs/03_Solution_Architecture.md)
- [UI/UX Requirements](docs/04_UI_UX_Requirements.md)
