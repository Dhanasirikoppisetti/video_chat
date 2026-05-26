"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const dev = process.env.NODE_ENV !== "production";
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
const port = Number(process.env.PORT) || 3000;
const rooms = {};
app.prepare().then(() => {
    const httpServer = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);
        socket.on("join-room", (roomId) => {
            if (!rooms[roomId]) {
                rooms[roomId] = new Set();
            }
            rooms[roomId].add(socket.id);
            socket.join(roomId);
            const otherUsers = Array.from(rooms[roomId]).filter((id) => id !== socket.id);
            socket.emit("all-users", otherUsers);
            socket.to(roomId).emit("user-joined", socket.id);
            console.log(`Socket ${socket.id} joined room ${roomId}`);
        });
        socket.on("offer", ({ target, sdp, caller }) => {
            io.to(target).emit("offer", {
                sdp,
                caller,
            });
        });
        socket.on("answer", ({ target, sdp }) => {
            io.to(target).emit("answer", {
                sdp,
                responder: socket.id,
            });
        });
        socket.on("ice-candidate", ({ target, candidate }) => {
            io.to(target).emit("ice-candidate", {
                candidate,
                from: socket.id,
            });
        });
        socket.on("chat-message", ({ roomId, message, sender, id, timestamp }) => {
            const payload = {
                id: id ?? `${socket.id}-${Date.now()}`,
                roomId,
                message,
                sender,
                timestamp: timestamp ?? Date.now(),
            };
            const roomMembers = rooms[roomId];
            if (!roomMembers) {
                return;
            }
            roomMembers.forEach((memberId) => {
                io.to(memberId).emit("chat-message", payload);
            });
        });
        socket.on("disconnect", () => {
            console.log("Disconnected:", socket.id);
            for (const roomId in rooms) {
                rooms[roomId].delete(socket.id);
                socket.to(roomId).emit("user-left", socket.id);
                if (rooms[roomId].size === 0) {
                    delete rooms[roomId];
                }
            }
        });
    });
    httpServer.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});
