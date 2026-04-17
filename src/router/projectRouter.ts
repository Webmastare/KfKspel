import { path } from "d3";

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
    {
        path: "/defense-twoplay",
        name: "DefenseTwoPlay",
        component: () => import("@/pages/Kasper-Project/DefenseTwoPlay.vue"),
    },
    {
        path: "/coffee-queen",
        redirect: "/KfKbrygg",
    },
    {
        path: "/KfKbrygg",
        name: "KfKbrygg",
        component: () => import("@/pages/Kasper-Project/KfKbrygg.vue"),
    },
    {
        path: "/rps",
        name: "RockPaperScissors",
        component: () => import("@/pages/other/RockPaperScissors.vue"),
    },
    {
        path: "/kana",
        name: "KanaGame",
        component: () => import("@/pages/other/KanaGame.vue"),
    },
    {
        path: "/sandfall",
        name: "Sandfall",
        component: () => import("@/pages/Kasper-Project/SandFall.vue"),
    },
];
