import { defineStore } from "pinia";
import { supabase } from "@/utils/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  updated_at: string | null;
};

export const useAuthStore = defineStore("auth", {
  state: () => ({
    initialized: false,
    session: null as
      | Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
      | null,
    user: null as
      | Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]
      | null,
    profile: null as Profile | null,
    loadingProfile: false,
    isSigningUp: false, // Flag to prevent auto-fetch during signup
  }),

  getters: {
    isAuthed: (s) => !!s.user,
  },

  actions: {
    async init() {
      // Pick up existing session (JWT) from localStorage
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Get session:", session);
      this.session = session;
      this.user = session?.user ?? null;

      // Stay synced with any auth change
      supabase.auth.onAuthStateChange(async (_event, session) => {
        console.log("Auth event:", _event, session);
        this.session = session;
        this.user = session?.user ?? null;

        if (this.user && !this.isSigningUp) {
          await this.fetchProfile();
          console.log("Fetched profile:", this.profile);
        } else if (!this.user) {
          this.profile = null;
        }
      });

      this.initialized = true;
    },

    // --- Auth helpers ---
    async signIn(email: string, password: string) {
      return supabase.auth.signInWithPassword({ email, password });
    },
    async signUp(
      email: string,
      password: string,
      meta?: Record<string, any>,
    ) {
      this.isSigningUp = true;
      return await supabase.auth.signUp({
        email,
        password,
        options: meta ? { data: meta } : {},
      });
    },

    async signOut() {
      console.log("Signing out user:", this.user);
      await supabase.auth.signOut();
    },

    // --- Profile handling ---
    async updateProfile(patch: Partial<Profile>) {
      if (!this.user) return;
      // Add current timestamp for "updated_at"
      const { data, error } = await supabase
        .from("user_profiles")
        .update({
          ...patch,
          user_id: this.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", this.user.id)
        .select()
        .single();
      if (error) throw error;
      this.profile = data as Profile;
    },

    async createProfile(profile: Partial<Profile>) {
      console.log("Creating profile:", profile);
      if (!this.user) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .insert({
          ...profile,
          user_id: this.user.id,
          email: this.user.email,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) return error;
      this.profile = data as Profile;
      console.log("Created profile:", this.profile);
      return data;
    },

    // Complete signup process - call this after profile creation
    async completeSignup() {
      this.isSigningUp = false;
      if (this.user && !this.profile) {
        await this.fetchProfile();
      }
    },

    async fetchProfile() {
      if (!this.user) return;
      this.loadingProfile = true;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", this.user.id)
        .single();
      console.log("Fetch profile data:", data, error);
      if (error && error.code !== "PGRST116") console.error(error); // 'PGRST116' = no rows

      if (!data) {
        // If no profile row yet, create a minimal one
        console.log("No profile found, creating one for user:", this.user);
        this.profile = null;
        /*const { data: inserted, error: insertErr } = await supabase
          .from("user_profiles")
          .insert({
            user_id: this.user.id,
            username: null,
            full_name: this.user.user_metadata?.full_name ?? null,
            email: this.user.email,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (insertErr) console.error(insertErr);
        this.profile = inserted ?? null;*/
      } else {
        this.profile = data as Profile;
      }
      this.loadingProfile = false;
    },
  },
});
