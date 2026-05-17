# r_keeper-admin — Restaurant Admin Panel

Admin web dashboard for **Alto Coffee Bishkek** (Kyrgyzstani som). Serves as the backend management interface paired with an Expo POS mobile app. Both share the same Supabase project.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 + Radix UI primitives (shadcn/ui style) |
| Backend/DB | Supabase (PostgreSQL + RLS + RPCs) |
| Data fetching | TanStack React Query v5 |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Tables | TanStack React Table v8 |
| Auth | Supabase Auth (email/password, optional via `VITE_REQUIRE_AUTH`) |
| Icons | Lucide React |
| Date handling | date-fns |
| Toasts | sonner |
| Excel | xlsx (SheetJS) |

## Project Structure

```
src/
├── auth/               # AuthProvider, AuthGate, useAuth, auth-context
├── components/          # Layout, FloorPlan components, DecimalSuffixInput
├── hooks/               # One hook per data domain (14 hooks)
│   ├── useDashboardData.ts
│   ├── useMenuData.ts         # Categories, dishes, ingredients, warehouses
│   ├── useWarehouse.ts        # Deliveries, write-offs, transfers, inventory
│   ├── useShiftsData.ts       # Cash shifts
│   ├── useChecksData.ts       # Order checks
│   ├── useStaffData.ts
│   ├── useCashTransactions.ts # Transactions journal
│   ├── useFloorPlan.ts
│   ├── useTransactionCategories.ts
│   ├── useVenueSettings.ts
│   ├── useDishData.ts
│   └── useWiggle.ts           # Animation helper
├── lib/
│   ├── supabase.ts            # Client, venue/org/zone IDs, REQUIRE_AUTH
│   ├── utils.ts               # cn() — clsx + tailwind-merge
│   ├── formatSom.ts           # Currency formatting (сом)
│   ├── decimalMask.ts         # Input mask helpers
│   ├── ingredientStock.ts     # Stock calculation utilities
│   ├── inventoryPeriodMovements.ts  # RPC integration for inventory periods
│   ├── cashTransactionParse.ts
│   ├── checkItemsTableGrid.ts
│   ├── matchShiftForTimestamp.ts
│   └── units.ts               # Unit conversion
├── pages/               # 18 page components, warehouse pages are lazy-loaded
├── types/               # inventoryMovements.ts
assets/                  # Icons (svg)
supabase/
├── migrations/          # 23 timestamped SQL migrations (20260430–20260510)
├── smoke_checks/        # Health check SQL
└── config.toml          # Local Supabase config (pg v17, auth, storage, etc.)
docs/                    # 5 docs (inventory plan, health check, auth-rls, etc.)
refs/                    # Design reference screenshots (14 images)
types/                   # floor-plan.ts standalone types
```

## Architecture Patterns

### Data Flow
- **React Query** handles all server state with query keys like `['domain', VENUE_ID]`
- Custom hooks encapsulate `useQuery`/`useMutation` per domain
- On mutation success, invalidate related queries: `queryClient.invalidateQueries({ queryKey: Q_KEY })`
- Supabase RPCs for complex multi-table operations (inventory movements, stock)

### Route Structure
- `/login` — public; all other routes behind `AuthGate`
- `AuthGate` wraps routes in `<Layout>` (sidebar + `<Outlet />`)
- Warehouse sub-pages (deliveries, write-offs, transfers, inventory, import, settings, warehouse admin) are **lazy-loaded** via `React.lazy()`
- Sidebar has 8 nav sections: Dashboard, Finances (3 sub), Menu (2 sub), Staff, Floor Plan, Warehouse (4 sub + dynamic per-warehouse), Import, Settings
- Dynamic warehouse routes: `/warehouse/:warehouseId`

### Key IDs from Environment
```ts
VENUE_ID            // default venue UUID (VITE_VENUE_ID)
ORG_ID              // organization UUID (VITE_ORG_ID)
FLOOR_PLAN_ZONE_ID  // primary zone synced with POS (VITE_FLOOR_PLAN_ZONE_ID)
LEGACY_ADMIN_ZONE_ID // zone to migrate orders from (VITE_LEGACY_ADMIN_ZONE_ID)
REQUIRE_AUTH        // boolean toggle for login gate (VITE_REQUIRE_AUTH)
```

## Common Commands

```bash
npm run dev           # Start dev server (Vite, default http://localhost:5173)
npm run build         # Type-check + production build to dist/
npm run preview       # Preview production build
npm run lint          # ESLint
```

### Supabase (local dev)
```bash
supabase start        # Start local Supabase stack
supabase stop         # Stop local Supabase stack
supabase db push      # Push migrations to local DB
supabase db reset     # Reset local DB (reruns migrations + seed)
```

## Database (Supabase)

### Shared with POS
Admin and Expo POS app use the **same Supabase project**. Environment variables must match:
- `VITE_SUPABASE_URL` = `EXPO_PUBLIC_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` = `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Migrations (23 files)
Key migrations by domain:
- **Warehouse**: `*admin_warehouse*`, `*warehouse_stock_rpcs*`, `*warehouse_doc_fields*`, `*warehouse_alignment*`, `*stock_items_*`
- **Floor plan**: `*tables_layout_columns*`, `*zones_updated_at*`
- **Shifts/Cash**: `*shifts_closing_cash_count*`, `*cash_transaction_categories*`, `*shift_open_close_notes*`
- **Inventory**: `*admin_inventory_period_movements*`, `*admin_inventory_warehouse_rpc*`
- **Transfers**: `*workshop_stock_transfers*`, `*simplify_transfers*`, `*warehouse_transfers_nullable_workshops*`
- **RLS/Security**: `*rls_venue_scoped*`, `*security_perf_cleanup*`, `*warehouse_admin_rls*`, `*stock_items_rls*`
- **Stability**: `*admin_stability_hardening*`

### RLS Model
- All tables scoped by `venue_id`
- Production: policies should check `auth.uid()` via `user_venues` mapping
- Dev: `VITE_REQUIRE_AUTH=false` allows open access

## Current State & Ongoing Work

See `docs/inventory-mvp-plan.md` for the active task list:
- **Phase A**: Consumption calculation from sales (`order_items` × `recipe_items`) — NOT YET DONE
- **Phase B**: Warehouse movement aggregation per inventory period — NOT YET DONE
- **Phase C**: Partial inventory mode, cache invalidation improvements — NOT YET DONE

Inventory counting grid currently shows zeros for movement columns. The `inventoryPeriodMovements.ts` lib calls RPC `admin_inventory_period_movements` but the consumption data source (sales → ingredient usage) still needs implementation.

## Reference Docs

| Doc | Content |
|-----|---------|
| `docs/inventory-mvp-plan.md` | Active task checklist for inventory feature |
| `docs/ops-health-check.md` | Post-deploy verification procedures |
| `docs/inventory-admin-alignment.md` | Admin ↔ POS schema alignment guide |
| `docs/cash-transactions-journal.md` | Cash transaction schema and logic |
| `docs/auth-rls.md` | Auth and RLS production checklist |
