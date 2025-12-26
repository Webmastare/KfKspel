export default [
    {
        path: "/simulator",
        name: "KfkSimulator",
        component: () => import("@/pages/Kasper-Project/Simulator.vue"),
    },
    {
        path: "/plinko",
        name: "Plinko",
        component: () => import("@/pages/Kasper-Project/minigames/Plinko.vue"),
    },
    {
        path: "/tower-drop",
        name: "TowerDrop",
        component: () =>
            import("@/pages/Kasper-Project/minigames/TowerDrop.vue"),
    },
    {
        path: "/dodge-game",
        name: "DodgeGame",
        component: () => import("@/pages/Kasper-Project/minigames/Dodge.vue"),
    },
    {
        path: "/defense-game",
        name: "DefenseGame",
        component: () => import("@/pages/Kasper-Project/Defense.vue"),
    },
];
