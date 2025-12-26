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
        component: () => import("@/pages/games/KfKblock.vue"),
    },
    {
        path: "/kfkbandvagn",
        name: "KfKbandvagn",
        component: () => import("@/pages/games/KfKbandvagn.vue"),
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
        component: () => import("@/pages/games/KfkBatians.vue"),
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
];
