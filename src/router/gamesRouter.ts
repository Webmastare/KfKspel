import path from "path";

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
    {
        path: "/ordel",
        name: "Ordel",
        component: () => import("@/pages/Ordel.vue"),
    },
    {
        path: "/plinko",
        name: "Plinko",
        component: () => import("@/pages/minigames/Plinko.vue"),
    },
    {
        path: "/tower-drop",
        name: "TowerDrop",
        component: () => import("@/pages/minigames/TowerDrop.vue"),
    },
];
