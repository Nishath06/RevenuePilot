import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { useAuthStore } from './store/authStore';

import { LoginPage }        from './pages/LoginPage';
import { DashboardPage }    from './pages/DashboardPage';
import { AutomationCenter } from './pages/AutomationCenter';
import { CopilotPage }      from './pages/CopilotPage';
import { ReportsCenter }    from './pages/ReportsCenter';
import { RevenuePage }      from './pages/RevenuePage';
import { OrdersPage }       from './pages/OrdersPage';
import { PaymentsPage }     from './pages/PaymentsPage';
import { InventoryPage }    from './pages/InventoryPage';
import { RecoveryPage }     from './pages/RecoveryPage';
import { CustomersPage }    from './pages/CustomersPage';
import { ForecastPage }     from './pages/ForecastPage';
import { IncidentsPage }    from './pages/IncidentsPage';
import { WebhooksPage }     from './pages/WebhooksPage';
import { SettingsPage }     from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

export const App: React.FC = () => {
  const { checkAuth } = useAuthStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/"           element={<DashboardPage />} />
              <Route path="/automation"  element={<AutomationCenter />} />
              <Route path="/copilot"    element={<CopilotPage />} />
              <Route path="/reports"    element={<ReportsCenter />} />
              <Route path="/revenue"    element={<RevenuePage />} />
              <Route path="/orders"     element={<OrdersPage />} />
              <Route path="/payments"   element={<PaymentsPage />} />
              <Route path="/inventory"  element={<InventoryPage />} />
              <Route path="/recovery"   element={<RecoveryPage />} />
              <Route path="/customers"  element={<CustomersPage />} />
              <Route path="/forecast"   element={<ForecastPage />} />
              <Route path="/incidents"  element={<IncidentsPage />} />
              <Route path="/webhooks"   element={<WebhooksPage />} />
              <Route path="/settings"   element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#111827', color: '#e2e8f0', border: '1px solid #1E293B', fontSize: 13 },
        }}
      />
    </QueryClientProvider>
  );
};

export default App;
