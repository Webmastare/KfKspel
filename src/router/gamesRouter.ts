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
        path: "/snake",
        name: "Snake",
        component: () => import("@/pages/Snake.vue"),
    },
];
