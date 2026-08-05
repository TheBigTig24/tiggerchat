import "dotenv/config";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { appRouter } from  "./api/root";
import { db } from "./db";
import { EventEmitter } from "events";

const ee = new EventEmitter();

const wss = new WebSocketServer({
    port: 3001,
});

const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: () => {
        return {
            db,
            ee,
            session: {
                user: { name: "Chat User", id: "ws-user" },
                expires: "9999-12-31T23:59:59.999z",
            },
            headers: new Headers(),
        };
    },
});

wss.on("connection", (ws) => {
    console.log(`Connections (${wss.clients.size})`);
    ws.once("close", () => {
        console.log(`Connection (${wss.clients.size})`);
    });
});

console.log("WebSocket Server listening on ws://localhost:3001");

process.on("SIGTERM", () => {
    console.log("SIGTERM");
    handler.broadcastReconnectNotification();
    wss.close();
});
