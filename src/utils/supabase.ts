import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: true, // default true
            autoRefreshToken: true, // default true
            detectSessionInUrl: true, // default true (for OAuth)
        },
    },
);
