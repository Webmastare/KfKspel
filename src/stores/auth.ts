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
    session: null as
      | Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >["data"]["session"]
      | null,
    user: null as
      | Awaited<
        ReturnType<typeof supabase.auth.getUser>
      >["data"]["user"]
      | null,
    profile: null as Profile | null,
    loadingProfile: false,
    initialized: false,
  }),

  getters: {
    isAuthed: (s) => !!s.user,
  },

  actions: {
    /** Initialize auth listener + pick up session */
    async init() {
      if (this.initialized) return;

      // Get the current session at startup
      const {
        data: { session },
      } = await supabase.auth.getSession();

      this.session = session;
      this.user = session?.user ?? null;
      if (this.user) {
        await this.fetchProfile();
      }

      // Listen to ALL auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event, session);
        this.session = session;
        this.user = session?.user ?? null;

        if (this.user) {
          this.fetchProfile();
        } else {
          this.profile = null;
        }
      });

      this.initialized = true;
    },

    /** Sign in */
    async signIn(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { data, error };
    },

    /** Sign up */
    async signUp(email: string, password: string, meta?: Record<string, any>) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: meta ? { data: meta } : {},
      });
      if (error) throw error;
      return { data, error };
    },

    /** Sign out (with error handling) */
    async signOut() {
      console.log("Signing out user:", this.user);
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log("Signed out successfully");
      } catch (err) {
        console.error("Sign out failed:", err);
      }
    },

    /** Refresh session manually */
    async refreshSession() {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Failed to refresh session:", error);
        return;
      }
      this.session = data.session;
      this.user = data.session?.user ?? null;
    },

    /** Profile handling */
    async fetchProfile() {
      if (!this.user) return;
      this.loadingProfile = true;

      console.log("Fetching profile for user:", this.user.id);
      console.log("Supabase instance:", supabase);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", this.user.id)
        .single();
      console.log("Profile fetch result:", { data, error });

      if (error && error.code !== "PGRST116") {
        console.error("Profile fetch error:", error);
      }

      this.profile = data as Profile;
      this.loadingProfile = false;
    },

    async updateProfile(patch: Partial<Profile>) {
      if (!this.user) return;
      const { data, error } = await supabase
        .from("user_profiles")
        .update({
          ...patch,
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
  },
});
