import { Hono } from "jsr:@hono/hono";

export function createApp(basePath: string) {
    const app = new Hono().basePath(basePath);
    app.use("*", corsMiddleware()); // attaches CORS globally
    app.options("*", (c) => c.body(null, 204)); // preflight helper
    return app;
}

// CORS configuration for edge functions
const allowedOrigins = [
    "http://localhost:3000", // Vite dev server
    "http://localhost:5173", // Vite dev server
    "https://kfkb.se",
    "webmaster.github.io",
    "*",
];
type Context = {
    req: {
        header: (name: string) => string | undefined;
        method: string;
    };
    header: (name: string, value: string) => void;
    body: (body: unknown, status: number) => Response;
};

type Next = () => Promise<void>;

export function corsMiddleware() {
    return async (c: Context, next: Next) => {
        const origin = c.req.header("Origin");

        // Check if origin is allowed (or allow all if using "*")
        const isAllowed = allowedOrigins.includes("*") ||
            (origin && allowedOrigins.includes(origin));

        // Set CORS headers
        if (isAllowed) {
            c.header("Access-Control-Allow-Origin", origin || "*");
        }

        c.header(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        );
        c.header("Access-Control-Allow-Headers", "*");
        c.header("Access-Control-Allow-Credentials", "true");
        c.header("Access-Control-Max-Age", "86400"); // 24 hours

        // Handle preflight requests
        if (c.req.method === "OPTIONS") {
            return c.body(null, 204);
        }

        await next();
    };
}
