import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gmigxjrvypqjakvualil.supabase.co';
const supabaseKey = 'sb_publishable_bNXLWbJVGS5Dp2FUPywFkQ_9Cg_mPTu';

export const supabase = createClient(supabaseUrl, supabaseKey);

// MVP: hardcoded venue
export const VENUE_ID = '00000000-0000-0000-0000-000000000010';
