import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export interface VenueRow {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
}

export function useVenue() {
  return useQuery({
    queryKey: ['venue', VENUE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, address, phone')
        .eq('id', VENUE_ID)
        .maybeSingle();
      if (error) throw error;
      return data as VenueRow | null;
    },
    retry: false,
  });
}

export function useUpdateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<VenueRow, 'name' | 'address' | 'phone'>>) => {
      const { error } = await supabase.from('venues').update(patch).eq('id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venue', VENUE_ID] }),
  });
}
