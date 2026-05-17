import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://gmigxjrvypqjakvualil.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_bNXLWbJVGS5Dp2FUPywFkQ_9Cg_mPTu';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const VENUE_ID =
  import.meta.env.VITE_VENUE_ID ?? '00000000-0000-0000-0000-000000000010';

/** Organization id for staff user creation */
export const ORG_ID =
  import.meta.env.VITE_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

/** Primary floor zone synced with POS (see seed / zones table) */
export const FLOOR_PLAN_ZONE_ID =
  import.meta.env.VITE_FLOOR_PLAN_ZONE_ID ??
  '00000000-0000-0000-0000-000000002001';

/** Legacy admin zone id — orders are reassigned then zone deleted on sync */
export const LEGACY_ADMIN_ZONE_ID =
  import.meta.env.VITE_LEGACY_ADMIN_ZONE_ID ??
  '00000000-0000-0000-0000-000000000100';

export const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true';
