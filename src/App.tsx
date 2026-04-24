import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Menu } from '@/pages/Menu';
import { Ingredients } from '@/pages/Ingredients';
import { Recipes } from '@/pages/Recipes';
import { Staff } from '@/pages/Staff';
import { FloorPlan } from '@/pages/FloorPlan';
import { Deliveries } from '@/pages/Deliveries';
import { WriteOffs } from '@/pages/WriteOffs';
import { Inventory } from '@/pages/Inventory';
import { Import } from '@/pages/Import';
import { SettingsPage } from '@/pages/SettingsPage';
import { DishEdit } from '@/pages/DishEdit';
import { CashShifts } from '@/pages/CashShifts';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cash-shifts" element={<CashShifts />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/menu/dish/:id" element={<DishEdit />} />
            <Route path="/menu/ingredients" element={<Ingredients />} />
            <Route path="/menu/recipes" element={<Recipes />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/floor-plan" element={<FloorPlan />} />
            <Route path="/warehouse" element={<Navigate to="/warehouse/deliveries" replace />} />
            <Route path="/warehouse/deliveries" element={<Deliveries />} />
            <Route path="/warehouse/write-offs" element={<WriteOffs />} />
            <Route path="/warehouse/inventory" element={<Inventory />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
