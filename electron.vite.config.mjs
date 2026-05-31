import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                input: {
                    index: resolve("src/main/index.js"),
                    "health-ipc": resolve("src/main/health-ipc.js"),
                    "health-parser": resolve("src/main/health-parser.js"),
                    "health-store": resolve("src/main/health-store.js"),
                    "strava-ipc": resolve("src/main/strava-ipc.js"),
                    "strava-auth": resolve("src/main/strava-auth.js"),
                    "strava-client": resolve("src/main/strava-client.js"),
                    "strava-store": resolve("src/main/strava-store.js"),
                    "coach-plan": resolve("src/main/coach-plan.js"),
                    "coach-plan-ipc": resolve("src/main/coach-plan-ipc.js"),
                    "coach-plan-store": resolve("src/main/coach-plan-store.js"),
                    "todo-ipc": resolve("src/main/todo-ipc.js"),
                    "todo-store": resolve("src/main/todo-store.js"),
                },
            },
        },
    },
    preload: {
        build: {
            rollupOptions: { input: { index: resolve("src/preload/index.js") } },
        },
    },
    renderer: {
        root: "src/renderer",
        build: {
            rollupOptions: { input: { index: resolve("src/renderer/index.html") } },
        },
        plugins: [react()],
    },
});
