import { defineStore } from "pinia";
import { readonly, ref, watch } from "vue";

type Theme = "light" | "dark";

export const useThemeStore = defineStore("theme", () => {
    // ========================================
    // STATE
    // ========================================

    const isDarkMode = ref(false);
    const initialized = ref(false);

    // ========================================
    // GETTERS
    // ========================================

    const currentTheme = () => isDarkMode.value ? "dark" : "light";

    // ========================================
    // ACTIONS
    // ========================================

    /**
     * Initialize theme system - detects system preference and loads saved theme
     */
    const init = () => {
        if (initialized.value) return;

        // Check for saved theme preference in localStorage
        const savedTheme = localStorage.getItem("kfkspel-theme");
        const prefersDarkQuery = window.matchMedia(
            "(prefers-color-scheme: dark)",
        );

        if (savedTheme && ["light", "dark"].includes(savedTheme)) {
            // Use saved preference
            isDarkMode.value = savedTheme === "dark";
        } else {
            // Use system preference
            isDarkMode.value = prefersDarkQuery.matches;
        }

        // Apply initial theme
        applyTheme();

        // Listen for system preference changes
        prefersDarkQuery.addEventListener("change", (e) => {
            // Only auto-update if user hasn't set a manual preference
            if (!localStorage.getItem("kfkspel-theme")) {
                isDarkMode.value = e.matches;
            }
        });

        // Watch for theme changes and apply them
        watch(isDarkMode, () => {
            applyTheme();
            saveTheme();
        });

        initialized.value = true;
    };

    /**
     * Toggle between light and dark theme
     */
    const toggleTheme = () => {
        isDarkMode.value = !isDarkMode.value;
    };

    /**
     * Set theme explicitly
     */
    const setTheme = (theme: Theme) => {
        if (theme === "light" || theme === "dark") {
            isDarkMode.value = theme === "dark";
        }
    };

    /**
     * Apply theme to document element
     */
    const applyTheme = () => {
        if (typeof document === "undefined") return;

        const htmlElement = document.documentElement;

        if (isDarkMode.value) {
            htmlElement.classList.add("dark-theme");
            htmlElement.classList.remove("light-theme");
        } else {
            htmlElement.classList.add("light-theme");
            htmlElement.classList.remove("dark-theme");
        }
    };

    /**
     * Save current theme to localStorage
     */
    const saveTheme = () => {
        localStorage.setItem("kfkspel-theme", currentTheme());
    };

    /**
     * Clear saved theme preference (will use system preference)
     */
    const clearSavedTheme = () => {
        localStorage.removeItem("kfkspel-theme");
        // Reset to system preference
        const prefersDarkQuery = window.matchMedia(
            "(prefers-color-scheme: dark)",
        );
        isDarkMode.value = prefersDarkQuery.matches;
    };

    /**
     * Remove old theme-related localStorage entries from individual games
     */
    const cleanupOldThemeStorage = () => {
        const oldThemeKeys = [
            "theme", // From Kfkblock and others
            "kfkbandvagn-theme", // From Kfkbandvagn
            "snake-theme", // If Snake had one
            "minesweeper-theme", // If Minesweeper had one
        ];

        oldThemeKeys.forEach((key) => {
            if (localStorage.getItem(key)) {
                console.log(`Cleaning up old theme storage: ${key}`);
                localStorage.removeItem(key);
            }
        });
    };

    // ========================================
    // RETURN PUBLIC API
    // ========================================

    return {
        // State
        isDarkMode: readonly(isDarkMode),
        initialized: readonly(initialized),

        // Getters
        currentTheme,

        // Actions
        init,
        toggleTheme,
        setTheme,
        clearSavedTheme,
        cleanupOldThemeStorage,
    };
});
