import { createClient } from "jsr:@supabase/supabase-js@2";

// Create Supabase client with service role key for server-side operations
export function createServiceClient() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    return createClient(supabaseUrl, supabaseServiceKey);
}

// Extract user ID from Authorization header
export function extractUserFromRequest(request: Request): string | null {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.substring(7);
    return token;
}

// Validate user session using Supabase Auth
export async function validateUserSession(authHeader: string | undefined) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);
    const supabase = createServiceClient();

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            throw new Error("Invalid or expired token");
        }

        return user;
    } catch (error) {
        console.error("User validation failed:", error);
        throw new Error("Authentication failed");
    }
}
