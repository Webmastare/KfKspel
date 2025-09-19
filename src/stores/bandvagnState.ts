import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { getGameState } from "@/composables/kfkbandvagn/board";
import {
  createPlayerAPI,
  loginPlayerAPI,
  performGameAction,
} from "@/composables/kfkbandvagn/gameActions";
import type { Player } from "@/composables/kfkbandvagn/player";
import type { GameBoard } from "@/composables/kfkbandvagn/board";
import type { GameActionType } from "@/composables/kfkbandvagn/gameActions";
import { supabase } from "@/utils/supabase";

export const useBandvagnStore = defineStore("bandvagn", {
  state: () => ({
    // Game data
    allPlayers: [] as Player[],
    currentPlayer: null as Player | null,
    boardData: null as GameBoard | null,

    // UI state
    initialized: false,
    isLoading: false,
    error: null as string | null,
    lastFetch: null as Date | null,
    selectedCell: null as { row: number; column: number } | null,

    // Auto-refresh settings
    autoRefreshEnabled: true,
    refreshInterval: 3600000, // 1 hour
    refreshTimeoutId: null as number | null,
  }),

  getters: {
    // Current player helpers
    isPlayerAlive: (state) => (state.currentPlayer?.lives || 0) > 0,
    canAffordUpgrade: (state) => (cost: number) =>
      (state.currentPlayer?.tokens || 0) >= cost,

    // Board helpers
    boardSize: (state) =>
      state.boardData
        ? {
          rows: state.boardData.rows,
          cols: state.boardData.cols,
        }
        : { rows: 0, cols: 0 },

    playableBoardSize: (state) => {
      if (!state.boardData) return { rows: 0, cols: 0 };
      const shrink = state.boardData.shrink || 0;
      return {
        rows: Math.max(1, state.boardData.rows - shrink * 2),
        cols: Math.max(1, state.boardData.cols - shrink * 2),
      };
    },

    // Game logs
    recentLogs: (state) => state.boardData?.logs?.slice(-20) || [],

    // Other players (excluding current player)
    otherPlayers: (state) =>
      state.allPlayers.filter((p: Player) =>
        p.uuid !== state.currentPlayer?.uuid && p.taken_tank
      ),

    // Data freshness
    isDataFresh: (state) => {
      if (!state.lastFetch) return false;
      const now = new Date();
      const timeDiff = now.getTime() - state.lastFetch.getTime();
      return timeDiff < 30000; // Fresh if less than 30 seconds old
    },

    // Game status
    gameStats: (state) => {
      const alivePlayers = state.allPlayers.filter((p: Player) =>
        p.lives > 0 && p.taken_tank
      ).length;
      const totalPlayers = state.allPlayers.filter((p: Player) =>
        p.taken_tank
      ).length;
      return {
        alivePlayers,
        totalPlayers,
        boardShrink: state.boardData?.shrink || 0,
      };
    },
  },

  actions: {
    // Initialize the store
    async initialize() {
      // Prevent multiple initializations
      console.log("Initializing bandvagn store");
      if (this.initialized) {
        console.log("Bandvagn store already initialized, skipping");
        return;
      }

      const authStore = useAuthStore();

      if (!authStore.isAuthed) {
        console.warn(
          "Cannot initialize bandvagn store - user not authenticated",
        );
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        await this.fetchGameState();
        this.initialized = true;

        // Start auto-refresh if enabled
        if (this.autoRefreshEnabled) {
          this.startAutoRefresh();
        }

        console.log("Bandvagn store initialized successfully");
      } catch (error) {
        console.error("Failed to initialize bandvagn store:", error);
        this.error = error instanceof Error
          ? error.message
          : "Initialization failed";
      } finally {
        this.isLoading = false;
      }
    },

    // Fetch current game state
    async fetchGameState() {
      this.isLoading = true;
      this.error = null;

      try {
        const gameState = await getGameState();

        // Update players data (from Edge Function - service role, safe)
        this.allPlayers = gameState.playerData || [];

        // Update board data - transform BoardData to GameBoard format
        if (gameState.boardData) {
          this.boardData = {
            rows: gameState.boardData.size!.rows,
            cols: gameState.boardData.size!.columns,
            shrink: gameState.boardData.shrink,
            logs: gameState.boardData.logs,
            upgrades: gameState.boardData.upgrades || [],
            time_to_shrink: gameState.boardData.time_to_shrink || "",
          };
        }

        // Fetch the current user's tank directly via RLS-protected client query
        await this.fetchCurrentUserTank();

        this.lastFetch = new Date();
        console.log("Game state updated:", {
          players: this.allPlayers.length,
          currentPlayer: !!this.currentPlayer,
          boardSize: this.boardSize,
        });
      } catch (error) {
        console.error("Failed to fetch game state:", error);
        this.error = error instanceof Error
          ? error.message
          : "Failed to fetch game state";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // Fetch only the current user's tank using Supabase client (RLS-protected)
    async fetchCurrentUserTank() {
      const authStore = useAuthStore();
      if (!authStore.user?.id) {
        this.currentPlayer = null;
        return null;
      }

      try {
        const { data, error } = await supabase
          .from("KfKbandvagn")
          .select(
            "user_id, playerID, uuid, tokens, position, lives, range, color, taken_tank",
          )
          .eq("user_id", authStore.user.id)
          .maybeSingle();

        if (error) {
          console.error("Failed to fetch current user's tank:", error);
          this.currentPlayer = null;
          return null;
        }

        // If no tank assigned yet
        if (!data || data.taken_tank === false) {
          this.currentPlayer = null;
          return null;
        }

        // Cast to Player and set
        this.currentPlayer = {
          uuid: data.uuid,
          playerID: data.playerID,
          position: data.position,
          lives: data.lives,
          tokens: data.tokens,
          range: data.range,
          taken_tank: data.taken_tank,
          color: data.color,
        } as Player;

        return this.currentPlayer;
      } catch (err) {
        console.error("Unexpected error fetching current user's tank:", err);
        this.currentPlayer = null;
        return null;
      }
    },

    // Create a new player
    async createPlayer(playerData: { playerID: string; color: string }) {
      const authStore = useAuthStore();

      if (!authStore.user?.id) {
        throw new Error("User not authenticated");
      }

      this.isLoading = true;
      this.error = null;

      try {
        const result = await createPlayerAPI({
          user_id: authStore.user.id,
          playerID: playerData.playerID,
          color: playerData.color,
        });

        // Refresh game state to get the new player
        await this.fetchGameState();

        return result;
      } catch (error) {
        console.error("Failed to create player:", error);
        this.error = error instanceof Error
          ? error.message
          : "Failed to create player";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // Login/authenticate existing player
    async loginPlayer() {
      const authStore = useAuthStore();

      if (!authStore.user?.id) {
        throw new Error("User not authenticated");
      }

      this.isLoading = true;
      this.error = null;

      try {
        const result = await loginPlayerAPI({
          user_id: authStore.user.id,
        });

        // Refresh game state after login
        await this.fetchGameState();

        return result;
      } catch (error) {
        console.error("Failed to login player:", error);
        this.error = error instanceof Error
          ? error.message
          : "Failed to login player";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // Perform a game action
    async performAction(action: {
      action: GameActionType;
      user_id: string;
      moveDirection?: { row: number; col: number };
      targetUUID?: string;
    }) {
      const authStore = useAuthStore();

      this.isLoading = true;
      this.error = null;

      try {
        console.log("Performing action:", action);
        const result = await performGameAction(action);
        console.log("Action result:", result);
        // Refresh game state after action
        console.log("Refreshing game state after action...");
        await this.fetchGameState();
        console.log("Game state refreshed successfully.");
        return result;
      } catch (error) {
        console.error("Action failed:", error);
        this.error = error instanceof Error ? error.message : "Action failed";
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // Get game statistics
    async fetchGameStats() {
      const authStore = useAuthStore();

      try {
        // Import getGameStats from board.ts
        const { getGameStats } = await import(
          "@/composables/kfkbandvagn/board"
        );
        const stats = await getGameStats();
        return stats;
      } catch (error) {
        console.error("Failed to fetch game stats:", error);
        throw error;
      }
    },

    // Auto-refresh functionality
    startAutoRefresh() {
      if (this.refreshTimeoutId) {
        clearTimeout(this.refreshTimeoutId);
      }

      this.refreshTimeoutId = window.setTimeout(async () => {
        if (this.autoRefreshEnabled && this.initialized) {
          try {
            await this.fetchGameState();
          } catch (error) {
            console.error("Auto-refresh failed:", error);
          }

          // Schedule next refresh
          this.startAutoRefresh();
        }
      }, this.refreshInterval);
    },

    stopAutoRefresh() {
      if (this.refreshTimeoutId) {
        clearTimeout(this.refreshTimeoutId);
        this.refreshTimeoutId = null;
      }
    },

    // Manual refresh with force option
    async forceRefresh() {
      this.lastFetch = null; // Force fresh data
      await this.fetchGameState();
    },

    // Cell selection helpers
    selectCell(cell: { row: number; column: number } | null) {
      this.selectedCell = cell;
    },

    // Validation helpers
    canMoveToCell(row: number, column: number): boolean {
      if (!this.currentPlayer) return false;

      const playableSize = this.playableBoardSize;
      const shrink = this.boardData?.shrink || 0;

      // Check if cell is within playable area
      if (
        row < shrink || row >= playableSize.rows + shrink ||
        column < shrink || column >= playableSize.cols + shrink
      ) {
        return false;
      }
      // Check if cell is occupied
      const occupied = this.allPlayers.some((p: Player) =>
        p.position.row === row && p.position.column === column && p.lives > 0
      );
      if (occupied) return false;

      // Check if cell is within range
      const distance = Math.abs(row - this.currentPlayer.position.row) +
        Math.abs(column - this.currentPlayer.position.column);

      return distance <= 1 && distance > 0 && this.currentPlayer.tokens >= 1; // Adjacent cells only
    },

    canShootAtCell(row: number, column: number): boolean {
      if (!this.currentPlayer) return false;

      // Check if there's a player at this position
      const targetPlayer = this.allPlayers.find((p: Player) =>
        p.position.row === row && p.position.column === column &&
        p.uuid !== this.currentPlayer?.uuid && p.taken_tank && p.lives > 0
      );

      if (!targetPlayer) return false;

      // Check if target is within range
      const distance = Math.abs(row - this.currentPlayer.position.row) +
        Math.abs(column - this.currentPlayer.position.column);

      return distance <= this.currentPlayer.range && distance > 0;
    },

    // Utility actions
    clearError() {
      this.error = null;
    },

    setAutoRefresh(enabled: boolean) {
      this.autoRefreshEnabled = enabled;

      if (enabled && this.initialized) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    },

    // Cleanup when user logs out
    reset() {
      this.stopAutoRefresh();
      this.allPlayers = [];
      this.currentPlayer = null;
      this.boardData = null;
      this.initialized = false;
      this.isLoading = false;
      this.error = null;
      this.lastFetch = null;
      this.selectedCell = null;
    },
  },
});
