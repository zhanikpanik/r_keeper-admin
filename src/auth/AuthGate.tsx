import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { REQUIRE_AUTH } from '@/lib/supabase';
import { useAuth } from '@/auth/useAuth';

export function AuthGate() {
 const { session, loading } = useAuth();
 const location = useLocation();

 if (!REQUIRE_AUTH) {
  return <Outlet />;
 }

 if (loading) {
  return (
   <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
    Загрузка…
   </div>
  );
 }

 if (!session) {
  return <Navigate to="/login" state={{ from: location }} replace />;
 }

 return <Outlet />;
}
