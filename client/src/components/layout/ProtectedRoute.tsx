import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for Zustand persist middleware to finish rehydrating from localStorage.
  // hasHydrated() is synchronous after the first microtask, but we need a
  // reactive trigger so we subscribe to the hydration event.
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist.hasHydrated(),
  );

  useEffect(() => {
    // If not yet hydrated (very first render before persist finishes),
    // subscribe to the finish event.
    if (!hydrated) {
      const unsub = useAuthStore.persist.onFinishHydration(() => {
        setHydrated(true);
      });
      // Also check again in case it completed between the useState init and here.
      if (useAuthStore.persist.hasHydrated()) setHydrated(true);
      return unsub;
    }
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
