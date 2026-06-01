import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/auth/AuthProvider';
import { AuthGate } from '@/auth/AuthGate';
import { Layout } from '@/components/Layout';
import { AnalyticsPage } from '@/pages/Analytics';
import { Dashboard } from '@/pages/DashboardNew';
import { Menu } from '@/pages/Menu';
import { Staff } from '@/pages/Staff';
import { FloorPlan } from '@/pages/FloorPlan';
import { CashShifts } from '@/pages/CashShifts';
import { Transactions } from '@/pages/Transactions';
import { Checks } from '@/pages/Checks';
import { Login } from '@/pages/Login';
import { useInitDefaults } from '@/hooks/useInitDefaults';

const AddIngredients = lazy(() => import('@/pages/AddIngredients').then((m) => ({ default: m.AddIngredients })));
const EditIngredient = lazy(() => import('@/pages/EditIngredient').then((m) => ({ default: m.EditIngredient })));
const Ingredients = lazy(() => import('@/pages/Ingredients').then((m) => ({ default: m.Ingredients })));
const DishEdit = lazy(() => import('@/pages/DishEdit').then((m) => ({ default: m.DishEdit })));
const Deliveries = lazy(() => import('@/pages/Deliveries').then((m) => ({ default: m.Deliveries })));
const NewDelivery = lazy(() => import('@/pages/NewDelivery').then((m) => ({ default: m.NewDelivery })));
const WriteOffs = lazy(() => import('@/pages/WriteOffs').then((m) => ({ default: m.WriteOffs })));
const NewWriteOff = lazy(() => import('@/pages/NewWriteOff').then((m) => ({ default: m.NewWriteOff })));
const Transfers = lazy(() => import('@/pages/Transfers').then((m) => ({ default: m.Transfers })));
const NewTransfer = lazy(() => import('@/pages/NewTransfer').then((m) => ({ default: m.NewTransfer })));
const Inventory = lazy(() => import('@/pages/Inventory').then((m) => ({ default: m.Inventory })));
const Import = lazy(() => import('@/pages/Import').then((m) => ({ default: m.Import })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const WarehousesAdmin = lazy(() => import('@/pages/WarehousesAdmin').then((m) => ({ default: m.WarehousesAdmin })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show previous data while refetching — no loading flash on SPA navigation
      placeholderData: (previousData: unknown) => previousData,
      // 2 min default: data considered fresh for 2 min, then background refetch
      staleTime: 2 * 60 * 1000,
      // 30 min garbage collection: keep unused cache data longer
      gcTime: 30 * 60 * 1000,
      // Admin panel: no need to refetch on window focus
      refetchOnWindowFocus: false,
      // Retry once on failure
      retry: 1,
    },
  },
});

// Persist query cache to localStorage — survives page refresh (F5)
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  // Throttle writes: persist at most once per second
  throttleTime: 1000,
});

// Bump CACHE_BUSTER to invalidate stale cache on next deploy
const CACHE_BUSTER = 'v1';

function PageFallback() {
 return <div className="p-8 text-sm text-muted-foreground">Загрузка…</div>;
}

function RedirectDeliveryToEdit() {
 const { id } = useParams();
 return <Navigate to={`/warehouse/deliveries/${id}/edit`} replace />;
}

function RedirectWriteOffToEdit() {
 const { id } = useParams();
 return <Navigate to={`/warehouse/write-offs/${id}/edit`} replace />;
}

function RedirectTransferToEdit() {
 const { id } = useParams();
 return <Navigate to={`/warehouse/transfers/${id}/edit`} replace />;
}

function App() {
 useInitDefaults();

 return (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      buster: CACHE_BUSTER,
      // Discard persisted cache older than 24h to prevent ghost entries
      maxAge: 24 * 60 * 60 * 1000,
    }}
  >
   <AuthProvider>
    <BrowserRouter>
     <Toaster position="bottom-right" richColors />
     <Suspense fallback={<PageFallback />}>
      <Routes>
       <Route path="/login" element={<Login />} />
       <Route element={<AuthGate />}>
        <Route element={<Layout />}>
         <Route path="/" element={<Dashboard />} />
         <Route path="/analytics" element={<AnalyticsPage />} />
         <Route path="/cash-shifts" element={<CashShifts />} />
         <Route path="/transactions" element={<Transactions />} />
         <Route path="/checks" element={<Checks />} />
         <Route path="/menu" element={<Menu />} />
         <Route path="/menu/dish/new" element={<DishEdit />} />
         <Route path="/menu/dish/:id" element={<DishEdit />} />
         <Route path="/menu/ingredients/add" element={<AddIngredients />} />
         <Route path="/menu/ingredients/:id" element={<EditIngredient />} />
         <Route path="/menu/ingredients" element={<Ingredients />} />
         <Route path="/staff" element={<Staff />} />
         <Route path="/floor-plan" element={<FloorPlan />} />
         <Route path="/warehouse" element={<Navigate to="/warehouse/deliveries" replace />} />
         <Route path="/warehouse/deliveries/new" element={<NewDelivery />} />
         <Route path="/warehouse/deliveries/:id/edit" element={<NewDelivery />} />
         <Route path="/warehouse/deliveries/:id" element={<RedirectDeliveryToEdit />} />
         <Route path="/warehouse/deliveries" element={<Deliveries />} />
         <Route path="/warehouse/write-offs/new" element={<NewWriteOff />} />
         <Route path="/warehouse/write-offs/:id/edit" element={<NewWriteOff />} />
         <Route path="/warehouse/write-offs/:id" element={<RedirectWriteOffToEdit />} />
         <Route path="/warehouse/write-offs" element={<WriteOffs />} />
         <Route path="/warehouse/transfers/new" element={<NewTransfer />} />
         <Route path="/warehouse/transfers/:id/edit" element={<NewTransfer />} />
         <Route path="/warehouse/transfers/:id" element={<RedirectTransferToEdit />} />
         <Route path="/warehouse/transfers" element={<Transfers />} />
         <Route path="/warehouse/inventory/:id" element={<Inventory />} />
         <Route path="/warehouse/inventory" element={<Inventory />} />
         <Route path="/warehouse/:warehouseId" element={<WarehousesAdmin />} />
         <Route path="/warehouse/settings" element={<Navigate to="/warehouse/deliveries" replace />} />
         <Route path="/import" element={<Import />} />
         <Route path="/settings" element={<SettingsPage />} />
        </Route>
       </Route>
      </Routes>
     </Suspense>
    </BrowserRouter>
   </AuthProvider>
  </PersistQueryClientProvider>
 );
}

export default App;
