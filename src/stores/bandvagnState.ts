import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import {
  createPlayerAPI,
  loginPlayerAPI,
  performGameAction,
} from "@/composables/kfkbandvagn/gameActions";
import type { Player } from "@/composables/kfkbandvagn/player";
import type { GameBoard } from "@/composables/kfkbandvagn/board";
import type { GameActionType } from "@/composables/kfkbandvagn/gameActions";
import { supabase } from "@/utils/supabase";
import {
  fetchActiveBoard,
  fetchAllPlayers,
  fetchGameStateClient,
  getPollingInfo,
  type RealtimeStatus,
  startPolling,
  stopPolling,
  triggerImmediatePoll,
} from "@/composables/kfkbandvagn/database";

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
    selectedCell: null as { row: number; column: number } | null,

    // Polling status
    realtimeStatus: "disconnected" as RealtimeStatus,
    lastRealtimeUpdate: null as Date | null,
    currentPollingInterval: 1000 as number,

    // Client-side action cooldown (UI-only)
    actionCooldownUntil: null as Date | null,
    minActionCooldownMs: 5000,
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
      const hs = (state.boardData as any).has_shrunked || { row: 0, column: 0 };
      return {
        rows: Math.max(1, state.boardData.rows - hs.row * 2),
        cols: Math.max(1, state.boardData.cols - hs.column * 2),
      };
    },

    // Game logs
    recentLogs: (state) => state.boardData?.logs?.slice(-20) || [],

    // Other players (excluding current player)
    otherPlayers: (state) =>
      state.allPlayers.filter((p: Player) =>
        p.uuid !== state.currentPlayer?.uuid && p.taken_tank
      ),

    // Game status
    gameStats: (state) => {
      const alivePlayers = state.allPlayers.filter((p: Player) =>
        p.lives > 0 && p.taken_tank
      ).length;
      const totalPlayers = state.allPlayers.filter((p: Player) =>
        p.taken_tank
      ).length;
      const hs = (state.boardData as any)?.has_shrunked ||
        { row: 0, column: 0 };
      const ts = (state.boardData as any)?.to_shrink || { row: 0, column: 0 };
      return {
        alivePlayers,
        totalPlayers,
        boardShrink: hs,
        nextShrink: ts,
        nextShrinkAt: (state.boardData as any)?.next_shrink || null,
      };
    },

    // Action cooldown helpers
    isActionOnCooldown: (state) => {
      if (!state.actionCooldownUntil) return false;
      return state.actionCooldownUntil.getTime() - Date.now() > 0;
    },
    actionCooldownRemainingMs: (state) => {
      if (!state.actionCooldownUntil) return 0;
      return Math.max(0, state.actionCooldownUntil.getTime() - Date.now());
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

        // Start visibility-aware polling, almost real-time updates
        this.startRealtime();
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
        console.log("Fetching game state...");
        const gameState = await fetchGameStateClient();

        // Update players data (from Edge Function - service role, safe)
        this.allPlayers = gameState.playerData || [];

        // Update board data - transform BoardData to GameBoard format
        if (gameState.boardData) {
          this.boardData = {
            rows: gameState.boardData.size!.rows,
            cols: gameState.boardData.size!.columns,
            has_shrunked: (gameState.boardData as any).has_shrunked ||
              { row: 0, column: 0 },
            to_shrink: (gameState.boardData as any).to_shrink ||
              { row: 0, column: 0 },
            logs: gameState.boardData.logs,
            upgrades: (gameState.boardData as any).upgrades || [],
            next_shrink: (gameState.boardData as any).next_shrink || "",
          } as unknown as GameBoard;
        }

        // Fetch the current user's tank directly via RLS-protected client query
        await this.fetchCurrentUserTank();

        this.lastRealtimeUpdate = new Date();
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

    // Start visibility-aware polling (replaces realtime)
    startRealtime() {
      // Avoid duplicate polling
      this.stopRealtime();

      startPolling({
        onStatusChange: (status, interval) => {
          this.realtimeStatus = status;
          // Store the current interval for debugging/display
          this.currentPollingInterval = interval;
        },
        onBoardUpdate: (row) => {
          // Map to GameBoard shape, keep animations smooth by only replacing fields
          this.boardData = {
            rows: row.size?.rows ?? this.boardData?.rows ?? 0,
            cols: row.size?.columns ?? this.boardData?.cols ?? 0,
            has_shrunked: (row as any).has_shrunked || { row: 0, column: 0 },
            to_shrink: (row as any).to_shrink || { row: 0, column: 0 },
            logs: row.logs || [],
            upgrades: (row as any).upgrades || [],
            next_shrink: (row as any).next_shrink || "",
          } as unknown as GameBoard;
          this.lastRealtimeUpdate = new Date();
        },
        onPlayersUpdate: (players) => {
          // Replace entire list to reflect latest state
          this.allPlayers = players;
          // Refresh currentPlayer reference
          if (this.currentPlayer) {
            const me = players.find((p) =>
              p.uuid === this.currentPlayer!.uuid
            ) || null;
            this.currentPlayer = me;
          }
          this.lastRealtimeUpdate = new Date();
        },
      });
    },

    stopRealtime() {
      stopPolling();
      this.realtimeStatus = "disconnected";
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

    // Perform a game action with animation support
    async performAction(action: {
      action: GameActionType;
      tank_id: string;
      targetCell?: { row: number; col: number };
      targetUUID?: string;
      count?: number;
      animationTrigger?: {
        triggerBulletAndExplosion?: (
          fromRow: number,
          fromCol: number,
          toRow: number,
          toCol: number,
          onComplete?: () => void,
        ) => void;
        triggerTankMove?: () => void;
      };
    }) {
      // Client-side guard against spamming while on cooldown
      if (this.isActionOnCooldown) {
        const secs = Math.ceil(this.actionCooldownRemainingMs / 1000);
        throw new Error(`Vänta ${secs}s innan nästa handling`);
      }
      this.isLoading = true;
      this.error = null;

      try {
        // Create proper ActionRequest object
        const actionRequest: any = {
          action: action.action,
          tank_id: action.tank_id,
        };

        // Add moveDirection for move actions
        if (action.action === "move" && action.targetCell) {
          actionRequest.moveDirection = {
            row: action.targetCell.row,
            col: action.targetCell.col,
          };
        }

        // Add targetUUID for shot actions
        if (action.action === "shot" && action.targetUUID) {
          actionRequest.targetUUID = action.targetUUID;
        }

        // Include count for multi-upgrades
        if (
          (action.action === "range" || action.action === "life") &&
          action.count
        ) {
          actionRequest.count = Math.max(1, Math.floor(action.count));
        }

        console.log("Performing action:", actionRequest);
        const result = await performGameAction(actionRequest);
        console.log("Action result:", result);

        // Handle shot actions with animation
        if (
          action.action === "shot" &&
          action.targetUUID &&
          this.currentPlayer
        ) {
          // Find target player to get position
          const targetPlayer = this.allPlayers.find((p) =>
            p.uuid === action.targetUUID
          );
          if (targetPlayer) {
            // Start client-side cooldown on successful action
            this.startActionCooldown();
            return result;
          }
        }
        // Handle move actions: do NOT update position immediately.
        // Insert logs right away so the canvas log-watcher can animate instantly,
        // and let realtime/state updates catch up the actual position.
        if (action.action === "move" && this.currentPlayer) {
          // Fire local animation immediately (logs watcher will dedupe)
          if (action.animationTrigger?.triggerTankMove) {
            action.animationTrigger.triggerTankMove();
          }
          // Start client-side cooldown on successful action
          this.startActionCooldown();
          return result;
        }

        // For non-shot and non-animated-move actions. Update current player and logs
        if (result.updatedData) {
          // Update local player data
          const currentIndex = this.allPlayers.findIndex((p) =>
            p.uuid === result.updatedData?.uuid
          );
          if (currentIndex !== -1) {
            this.allPlayers[currentIndex] = result.updatedData;
          }
          this.currentPlayer = result.updatedData;
        }
        console.log("Game state refreshed successfully.");
        // Start client-side cooldown on successful action
        this.startActionCooldown();
        // Trigger immediate poll to get associated log
        triggerImmediatePoll();
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

    // Cell selection helpers
    selectCell(cell: { row: number; column: number } | null) {
      this.selectedCell = cell;
    },

    // Validation helpers
    canMoveToCell(row: number, column: number): boolean {
      if (!this.currentPlayer) return false;

      const hs = (this.boardData as any)?.has_shrunked || { row: 0, column: 0 };

      // Check if cell is within board bounds
      if (
        row < 0 || row >= this.boardSize.rows ||
        column < 0 || column >= this.boardSize.cols
      ) {
        return false;
      }

      // Disallow moving into already shrunk (non-playable) area
      if (
        row < hs.row ||
        row >= this.boardSize.rows - hs.row ||
        column < hs.column ||
        column >= this.boardSize.cols - hs.column
      ) {
        return false;
      }

      // Check if cell is occupied by another living player
      const occupied = this.allPlayers.some((p: Player) =>
        p.position.row === row && p.position.column === column &&
        p.lives > 0 && p.uuid !== this.currentPlayer?.uuid
      );
      if (occupied) return false;

      // Don't allow move to same position
      if (
        this.currentPlayer.position.row === row &&
        this.currentPlayer.position.column === column
      ) {
        return false;
      }

      // Calculate Manhattan distance and required tokens
      const distance = Math.abs(row - this.currentPlayer.position.row) +
        Math.abs(column - this.currentPlayer.position.column);

      const requiredTokens = Math.max(1, distance);

      // Check if player has enough tokens for the move
      return this.currentPlayer.tokens >= requiredTokens;
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

    // Cleanup when user logs out
    reset() {
      this.stopRealtime();
      this.allPlayers = [];
      this.currentPlayer = null;
      this.boardData = null;
      this.initialized = false;
      this.isLoading = false;
      this.error = null;
      this.selectedCell = null;
      this.actionCooldownUntil = null;
    },

    // Cooldown controls (UI-only, easy to move server-side later)
    startActionCooldown(durationMs?: number) {
      const d = durationMs ?? this.minActionCooldownMs;
      this.actionCooldownUntil = new Date(Date.now() + d);
    },
    clearActionCooldown() {
      this.actionCooldownUntil = null;
    },
  },
});
