import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, REQUIRE_AUTH } from '@/lib/supabase';
import { AuthContext, type AuthValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
 const [session, setSession] = useState<Session | null>(null);
 const [loading, setLoading] = useState(REQUIRE_AUTH);

 useEffect(() => {
  if (!REQUIRE_AUTH) {
   return;
  }

  supabase.auth.getSession().then(({ data: { session: s } }) => {
   setSession(s);
   setLoading(false);
  });

  const {
   data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, s) => {
   setSession(s);
  });

  return () => subscription.unsubscribe();
 }, []);

 const signIn = useCallback(async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error as Error | null };
 }, []);

 const signOut = useCallback(async () => {
  await supabase.auth.signOut();
 }, []);

 const value = useMemo<AuthValue>(
  () => ({
   user: session?.user ?? null,
   session,
   loading,
   signIn,
   signOut,
  }),
  [session, loading, signIn, signOut]
 );

 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
