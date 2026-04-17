import type { RouteRecordRaw } from "vue-router";

type LazyRouteComponent = NonNullable<RouteRecordRaw["component"]>;

interface GameCatalogEntry {
    path: string;
    name: string;
    title: string;
    component: LazyRouteComponent;
    showOnLanding: boolean;
    showOnSecret: boolean;
}

interface GameLink {
    path: string;
    name: string;
    title: string;
}

const gameCatalog: GameCatalogEntry[] = [
    {
        path: "/2048",
        name: "2048",
        title: "2048",
        component: () => import("@/pages/games/2048.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/minesweeper",
        name: "Minesweeper",
        title: "Minesweeper",
        component: () => import("@/pages/games/Minesweeper.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/kfkblock",
        name: "KfKblock",
        title: "KfKblock",
        component: () => import("@/pages/games/Kfkblock.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/kfkbandvagn",
        name: "KfKbandvagn",
        title: "KfKbandvagn",
        component: () => import("@/pages/games/Kfkbandvagn.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/snake",
        name: "Snake",
        title: "Snake",
        component: () => import("@/pages/games/Snake.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/lights-out",
        name: "LightsOut",
        title: "Lights Out",
        component: () => import("@/pages/games/LightsOut.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/circle-game",
        name: "CircleGame",
        title: "Rita en Cirkel",
        component: () => import("@/pages/games/CircleGame.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/kfkbatians",
        name: "KfkBatians",
        title: "KfKBatians",
        component: () => import("@/pages/games/Kfkbatians.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/ordel",
        name: "Ordel",
        title: "Ordel",
        component: () => import("@/pages/games/Ordel.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/ordel-embed",
        name: "OrdelEmbed",
        title: "Ordel Embed",
        component: () => import("@/pages/games/OrdelEmbed.vue"),
        showOnLanding: false,
        showOnSecret: false,
    },
    {
        path: "/sudoku",
        name: "Sudoku",
        title: "Sudoku",
        component: () => import("@/pages/games/Sudoku.vue"),
        showOnLanding: true,
        showOnSecret: false,
    },
    {
        path: "/anagram",
        name: "Anagram",
        title: "Anagram",
        component: () => import("@/pages/games/AnagramGame.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/ordjakt",
        name: "Ordjakt",
        title: "Ordjakt",
        component: () => import("@/pages/games/HiddenWord.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/yoda",
        name: "Yoda.se",
        title: "Yoda.se",
        component: () => import("@/pages/games/Yoda.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/simulator",
        name: "KfkSimulator",
        title: "Simulator",
        component: () => import("@/pages/Kasper-Project/Simulator.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/plinko",
        name: "Plinko",
        title: "Plinko",
        component: () => import("@/pages/Kasper-Project/minigames/Plinko.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/tower-drop",
        name: "TowerDrop",
        title: "Tower Drop",
        component: () =>
            import("@/pages/Kasper-Project/minigames/TowerDrop.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/dodge-game",
        name: "DodgeGame",
        title: "Dodge Game",
        component: () => import("@/pages/Kasper-Project/minigames/Dodge.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/defense-game",
        name: "DefenseGame",
        title: "Defense Game",
        component: () => import("@/pages/Kasper-Project/Defense.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/defense-twoplay",
        name: "DefenseTwoPlay",
        title: "Defense Two Play",
        component: () => import("@/pages/Kasper-Project/DefenseTwoPlay.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/KfKbrygg",
        name: "KfKbrygg",
        title: "KfKbrygg",
        component: () => import("@/pages/Kasper-Project/KfKbrygg.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/rps",
        name: "RockPaperScissors",
        title: "Rock Paper Scissors",
        component: () => import("@/pages/other/RockPaperScissors.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/kana",
        name: "KanaGame",
        title: "Kana",
        component: () => import("@/pages/other/KanaGame.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
    {
        path: "/sandfall",
        name: "Sandfall",
        title: "Sandfall",
        component: () => import("@/pages/Kasper-Project/SandFall.vue"),
        showOnLanding: false,
        showOnSecret: true,
    },
];

function toRoute(entry: GameCatalogEntry): RouteRecordRaw {
    return {
        path: entry.path,
        name: entry.name,
        component: entry.component,
    };
}

function toLink(entry: GameCatalogEntry): GameLink {
    return {
        path: entry.path,
        name: entry.name,
        title: entry.title,
    };
}

export const gameRoutes = gameCatalog.map(toRoute);

export const landingGameLinks = gameCatalog.filter((entry) =>
    entry.showOnLanding
).map(toLink);

export const secretGameLinks = gameCatalog
    .filter((entry) => entry.showOnSecret && !entry.showOnLanding)
    .map(toLink);
