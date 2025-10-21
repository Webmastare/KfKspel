export interface Upgrade {
    id: string;
    name: string;
    description: string;
    icon: string;
    cost: number;
    costMultiplier?: number; // For multi-level upgrades
    costExponent?: number; // For scaling costs
    maxLevel?: number; // Defaults to 1 (single purchase)
    // Effects
    perClick?: number;
    clickMultiplier?: number;
    passivePerSecond?: number;
    critChance?: number;
    critMultiplier?: number;
    perBounce?: number; // For DVD-like entities
    // Media to display when owned
    gifSrc?: string;
    videoSrc?: string;
    audioSrc?: string;
    // For special entities like DVD
    spawnsDvd?: boolean;
    // Visual effects
    colorChangeOnBounce?: boolean; // Changes DVD color on bounce (+5 per bounce)
    showRain?: boolean; // Shows rain effect
    showThunder?: boolean; // Shows thunder effect
}

// Helper function to calculate cost at a given level
export function costAtLevel(
    baseCost: number,
    multiplier: number,
    level: number,
): number {
    return Math.floor(baseCost * Math.pow(multiplier, level));
}

// All upgrades in order (this is the order they'll appear when eligible)
export const UPGRADES: Upgrade[] = [
    {
        id: "dvd",
        name: "DVD Skärmsläckare",
        description: "Skapar en studsande DVD-logga. +1 kr per hörnträff.",
        icon: "/assets/simulator/dvd.webp",
        cost: 10,
        costMultiplier: 2,
        costExponent: 1.15,
        maxLevel: 30,
        spawnsDvd: true,
        perBounce: 1,
    },
    {
        id: "betterClick",
        name: "Bättre Klick",
        description: "+5 kr per klick",
        icon: "/favicon.ico",
        cost: 50,
        perClick: 5,
    },
    {
        id: "gibson",
        name: "Gibson Assembly",
        description: "Pedagogisk video. +2 kr/s",
        icon: "/favicon.ico",
        cost: 140,
        passivePerSecond: 2,
        videoSrc: "/assets/simulator/gibson.mp4",
    },
    {
        id: "subwaySurfers",
        name: "Subway Surfers",
        description: "Klassisk spel. +10 kr/s",
        icon: "/assets/simulator/subway-surfers.gif",
        cost: 250,
        passivePerSecond: 10,
    },
    {
        id: "mc_parkour",
        name: "MC Parkour",
        description: "Klassisk spel. +20 kr/s",
        icon: "/favicon.ico",
        cost: 500,
        passivePerSecond: 20,
    },
    {
        id: "nyanCat",
        name: "Nyan Cat",
        description: "Klassisk gif + musik. +2 kr/s",
        icon: "/favicon.ico",
        cost: 1500,
        passivePerSecond: 500,
        gifSrc: "/assets/simulator/nyan-cat.gif",
        audioSrc: "/assets/simulator/nyan-cat.mp3",
    },
    {
        id: "qpcr",
        name: "qPCR",
        description: "Vetenskap! +2 kr/s",
        icon: "/favicon.ico",
        cost: 140,
        passivePerSecond: 2,
        videoSrc: "/assets/simulator/qpcr.mp4",
    },
    {
        id: "mukbang",
        name: "Mukbang",
        description: "Varför inte? +3 kr/s",
        icon: "/favicon.ico",
        cost: 180,
        passivePerSecond: 3,
        videoSrc: "/assets/simulator/mukbang.mp4",
    },
    {
        id: "clickMultiplier",
        name: "Klickmultiplikator",
        description: "2x klickvärde",
        icon: "/favicon.ico",
        cost: 300,
        clickMultiplier: 2,
    },
    {
        id: "gangnamStyle",
        name: "Gangnam Style",
        description: "Whoop whoop! 10% chans för 10x klickvärde",
        icon: "/favicon.ico",
        cost: 500,
        critChance: 0.1,
        critMultiplier: 10,
        gifSrc: "/assets/simulator/gangnam-style.gif",
    },
    {
        id: "colorChange",
        name: "Regnbågs-DVD",
        description:
            "DVD:er byter färg vid studsar! +5 kr per studs (istället för +1)",
        icon: "/favicon.ico",
        cost: 200,
        colorChangeOnBounce: true,
        perBounce: 5,
    },
    {
        id: "rain",
        name: "Regn",
        description: "Lägg till regneffekt i bakgrunden. +2 kr/s",
        icon: "/favicon.ico",
        cost: 300,
        showRain: true,
        passivePerSecond: 2,
    },
    {
        id: "thunder",
        name: "Åska",
        description: "Dramatisk åskeffekt! +5 kr/s",
        icon: "/favicon.ico",
        cost: 600,
        showThunder: true,
        passivePerSecond: 5,
    },
];
