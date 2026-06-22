import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { REQUIRE_AUTH } from '@/lib/supabase';
import { useAuth } from '@/auth/useAuth';

export function Login() {
 const { session, signIn, loading } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const from =
  (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState<string | null>(null);
 const [submitting, setSubmitting] = useState(false);

 if (!REQUIRE_AUTH) {
  return <Navigate to="/" replace />;
 }

 if (!loading && session) {
  return <Navigate to={from} replace />;
 }

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setSubmitting(true);
  const { error: err } = await signIn(email.trim(), password);
  setSubmitting(false);
  if (err) {
   setError(err.message);
   return;
  }
  navigate(from, { replace: true });
 }

 return (
  <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
   <div className="w-full max-w-sm border bg-card rounded-xl p-8 shadow-sm">
    <h1 className="text-xl font-bold mb-1">r_keeper</h1>
    <p className="text-sm text-muted-foreground mb-6">Вход в панель управления</p>

    <form onSubmit={handleSubmit} className="space-y-4">
     <div>
      <label className="text-sm font-medium text-muted-foreground">Эл. почта</label>
      <input
       type="email"
       autoComplete="email"
       className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background"
       value={email}
       onChange={(e) => setEmail(e.target.value)}
       required
      />
     </div>
     <div>
      <label className="text-sm font-medium text-muted-foreground">Пароль</label>
      <input
       type="password"
       autoComplete="current-password"
       className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background"
       value={password}
       onChange={(e) => setPassword(e.target.value)}
       required
      />
     </div>
     {error && <p className="text-sm text-destructive">{error}</p>}
     <button
      type="submit"
      disabled={submitting}
      className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
     >
      {submitting ? 'Вход…' : 'Войти'}
     </button>
    </form>
   </div>
  </div>
 );
}
