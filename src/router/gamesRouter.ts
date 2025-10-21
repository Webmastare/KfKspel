export default [
    {
        path: "/2048",
        name: "2048",
        component: () => import("@/pages/2048.vue"),
    },
    {
        path: "/minesweeper",
        name: "Minesweeper",
        component: () => import("@/pages/Minesweeper.vue"),
    },
    {
        path: "/kfkblock",
        name: "KfKblock",
        component: () => import("@/pages/KfKblock.vue"),
    },
    {
        path: "/kfkbandvagn",
        name: "KfKbandvagn",
        component: () => import("@/pages/Kfkbandvagn.vue"),
    },
    {
        path: "/snake",
        name: "Snake",
        component: () => import("@/pages/Snake.vue"),
    },
    {
        path: "/lights-out",
        name: "LightsOut",
        component: () => import("@/pages/LightsOut.vue"),
    },
    {
        path: "/circle-game",
        name: "CircleGame",
        component: () => import("@/pages/CircleGame.vue"),
    },
    {
        path: "/simulator",
        name: "KfkSimulator",
        component: () => import("@/pages/Simulator.vue"),
    },
];
