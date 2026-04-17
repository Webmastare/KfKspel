import { path } from "d3";

export default [
    {
        path: "/2048",
        name: "2048",
        component: () => import("@/pages/games/2048.vue"),
    },
    {
        path: "/minesweeper",
        name: "Minesweeper",
        component: () => import("@/pages/games/Minesweeper.vue"),
    },
    {
        path: "/kfkblock",
        name: "KfKblock",
        component: () => import("@/pages/games/Kfkblock.vue"),
    },
    {
        path: "/kfkbandvagn",
        name: "KfKbandvagn",
        component: () => import("@/pages/games/Kfkbandvagn.vue"),
    },
    {
        path: "/snake",
        name: "Snake",
        component: () => import("@/pages/games/Snake.vue"),
    },
    {
        path: "/lights-out",
        name: "LightsOut",
        component: () => import("@/pages/games/LightsOut.vue"),
    },
    {
        path: "/circle-game",
        name: "CircleGame",
        component: () => import("@/pages/games/CircleGame.vue"),
    },
    {
        path: "/kfkbatians",
        name: "KfkBatians",
        component: () => import("@/pages/games/Kfkbatians.vue"),
    },
    {
        path: "/ordel",
        name: "Ordel",
        component: () => import("@/pages/games/Ordel.vue"),
    },
    {
        path: "/ordel-embed",
        name: "OrdelEmbed",
        component: () => import("@/pages/games/OrdelEmbed.vue"),
    },
    {
        path: "/sudoku",
        name: "Sudoku",
        component: () => import("@/pages/games/Sudoku.vue"),
    },
    {
        path: "/anagram",
        name: "Anagram",
        component: () => import("@/pages/games/AnagramGame.vue"),
    },
    {
        path: "/ordjakt",
        name: "Ordjakt",
        component: () => import("@/pages/games/HiddenWord.vue"),
    },
    {
        path: "/yoda",
        name: "Yoda.se",
        component: () => import("@/pages/games/Yoda.vue"),
    },
];
