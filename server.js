import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import clientRoutes from './Routes/ClientRoutes.js';
import adminRoutes from './Routes/AdminRoutes.js';
import chatRoutes from './Routes/ChatRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './database/DB.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP server (socket.io için)
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Online kullanıcıları sakla: userId -> socket.id
const onlineUsers = new Map();

io.on("connection", (socket) => {
    console.log("Yeni kullanıcı bağlandı:", socket.id);

    // Kullanıcı login olduğunda
    socket.on("login", (userId) => {
        socket.userId = userId; // sender_id backend'den alınacak
        onlineUsers.set(userId, socket.id);
        console.log("Online kullanıcılar:", Array.from(onlineUsers.keys()));
    });

    // Mesaj gönderme
    socket.on("sendMessage", async (data) => {
        console.log("sendMessage tetiklendi, data:", data, "socket.userId:", socket.userId);

        try {
            const sender_id = socket.userId;
            const receiver_id = data.receiver_id;
            const message = data.message;

            if (!sender_id || !receiver_id || !message) {
                console.log("Eksik veri:", { sender_id, receiver_id, message });
                return socket.emit("errorMessage", { error: "Eksik veri" });
            }

            // DB kaydı
            await db.query(
                "INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)",
                [sender_id, receiver_id, message]
            );

            const msgPayload = { sender_id, receiver_id, message };

            // Alıcı online ise sadece ona gönder
            const receiverSocketId = onlineUsers.get(receiver_id);
            if (receiverSocketId) io.to(receiverSocketId).emit("receiveMessage", msgPayload);

            // Gönderenin ekranına da göster
            socket.emit("receiveMessage", msgPayload);

        } catch (err) {
            console.error("Mesaj DB'ye kaydedilemedi:", err);
            socket.emit("errorMessage", { error: "Mesaj kaydedilemedi" });
        }
    });

    // Disconnect
    socket.on("disconnect", () => {
        onlineUsers.forEach((value, key) => {
            if (value === socket.id) onlineUsers.delete(key);
        });
        console.log("Kullanıcı ayrıldı:", socket.id);
    });
});

// Statik dosyalar
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS ayarları
const corsOptions = {
    origin: '*',
    methods: 'GET,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Route'lar
app.use('/api/clients', clientRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/chat', chatRoutes);

// Server başlat
httpServer.listen(PORT, () => {
    console.log(`Server ${PORT} portunda başladı.`);
});
