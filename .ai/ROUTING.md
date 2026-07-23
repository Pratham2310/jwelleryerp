# ROUTING.md

## 1. Router Setup

`react-router-dom` v7, using **`HashRouter`** (URLs look like `#/dashboard`, not `/dashboard`) — chosen presumably because this is deployed as a static single-page bundle (Google AI Studio / Cloud Run static hosting) with no server-side routing configured to fall back to `index.html` for arbitrary paths. **If this app is ever deployed behind a real backend/CDN with proper SPA fallback routing configured, switching to `BrowserRouter` would give cleaner URLs** — but do this deliberately, since any saved bookmarks/links using the `#/` scheme would break.

`App.tsx` wraps everything: `<Router><AppContent /></Router>`. All route logic lives inside `AppContent`, which calls `useNavigate()`/`useLocation()`.

## 2. Auth Gate

There is no `<PrivateRoute>` wrapper component — auth gating is a single `if (!user) { return <Routes>...</Routes> }` short-circuit at the top of `AppContent`, before the main app `<Routes>` block:

```tsx
if (!user) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
      <Route path="/register" element={<RegisterPage onRegisterSuccess={handleLoginSuccess} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```
`user` is `{ name, role, branch } | null`, read from `localStorage['stitch_auth_user']` at mount. **There is no per-route role check** — once `user` is truthy (via real login OR the Guest button), every route below is fully accessible regardless of `user.role`. If/when real RBAC is introduced, this is the point where a route-level permission check needs to be added (see PRD §3 for the persona/permission matrix, and §15.1 for RBAC requirements).

## 3. Route Table (authenticated app)

| Path | Component | Key Props Wired |
|---|---|---|
| `/` | → redirects to `/dashboard` | — |
| `/dashboard` | `Dashboard` | `metalRates`, `setMetalRates`, `items`, `customersCount`, `karigars`, `invoices`, `activeWorkOrdersCount`, `setActiveTab` (navigates via `'/' + tab'`), `openAddModal` (opens Catalog's add-item modal *and* navigates to `/catalog`), `openIssueOrderModal` (opens Karigar's issue-order modal *and* navigates to `/karigar`) |
| `/catalog` | `CatalogManager` | `items`, `setItems`, `isAddModalOpen`, `setAddModalOpen` (both lifted to `App`, so Dashboard's quick-action can pre-open this modal) |
| `/stones` | `StoneManager` | `karigars` only — the module's own `LooseStone[]` state is **not** lifted (see `FRONTEND_ARCHITECTURE.md` §3) |
| `/billing` | `BillingEstimator` | `items`, `setItems`, `customers`, `metalRates`, `invoices`, `setInvoices` |
| `/karigar` | `KarigarManager` | `karigars`, `setKarigars`, `workOrders`, `setWorkOrders`, `isIssueModalOpen`, `setIssueModalOpen` |
| `/jobbags` | `JobBagManager` | `karigars` only — same "own state" pattern as `/stones` |
| `/customers` | `CustomerManager` | `customers`, `setCustomers` |
| `*` (unauthenticated fallback) | → redirects to `/login` | — |
| `*` (authenticated fallback) | → redirects to `/dashboard` | — |

Note `/billing` supports an extra query param: `?tab=history` shows the invoice registry tab instead of the create-invoice tab (read manually from `window.location.search`, see `FRONTEND_ARCHITECTURE.md` §5).

## 4. Sidebar Navigation Source of Truth

`Sidebar.tsx`'s `menuItems` array is the canonical nav-link list (path, display name, icon, one-line description) and must be kept in sync with the route table above whenever a new screen/route is added — there is no shared route-config module that both the router and the sidebar read from; **update both places by hand.**

```
/dashboard  → Dashboard Overview
/catalog    → Catalog & Showcase
/stones     → Stones & Diamonds
/billing    → Billing Estimator
/karigar    → Karigar & Jobwork
/jobbags    → Job Bags Tracker
/customers  → Customers & Schemes
```

## 5. Side Effects on Every Navigation

An effect in `AppContent` fires on every `location.pathname` change (while `user` is set): it closes the mobile sidebar, triggers the fake loading-skeleton state for `latency` ms, and — if `forceOffline` is on — shows the simulated "Database Connection Timeout" error screen instead of the route's content. This is purely a demo/prototype affordance (see `ARCHITECTURE.md` §1) and has no bearing on real navigation guards or data fetching once a real API exists.

## 6. Adding a New Route (checklist for the next agent)

1. Add the `<Route path="..." element={...} />` inside the authenticated `<Routes>` block in `App.tsx`.
2. Add a matching entry to `Sidebar.tsx`'s `menuItems`.
3. Decide state ownership up front: lift shared domain state to `App.tsx` (majority pattern) rather than introducing another isolated-component-state module like `StoneManager`/`JobBagManager` did — see `FRONTEND_ARCHITECTURE.md` §3 and `CODING_RULES.md`.
4. If the new screen needs the live theme, either read `localStorage`/`MutationObserver` (existing, duplicated pattern) or — preferably — introduce and use a shared `useTheme()` hook (see `TODO.md`) rather than adding an eighth copy of the boilerplate.
