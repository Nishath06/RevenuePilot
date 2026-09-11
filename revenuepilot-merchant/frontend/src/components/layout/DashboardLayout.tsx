import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export const DashboardLayout: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onRefresh={handleRefresh} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ refreshKey }} />
        </main>
      </div>
    </div>
  );
};
