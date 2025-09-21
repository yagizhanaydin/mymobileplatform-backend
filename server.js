import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import clientRoutes from './Routes/ClientRoutes.js'
import adminRoutes from './Routes/AdminRoutes.js' 
import chatRoutes from './Routes/ChatRoutes.js' // chat route ekledik
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http'
import { Server } from 'socket.io'
import db from './database/DB.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
const PORT = process.env.PORT || 3000

// http server oluştur (socket.io için)
const httpServer = createServer(app)

// Socket.IO bağla
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

// Online kullanıcıları sakla: userId -> socket.id
const onlineUsers = new Map()

io.on("connection", (socket) => {
    console.log("Yeni kullanıcı bağlandı:", socket.id)

    // Kullanıcı login olunca userId ile ekle
    socket.on("login", (userId) => {
        onlineUsers.set(userId, socket.id)
        console.log("Online kullanıcılar:", Array.from(onlineUsers.keys()))
    })

    socket.on("sendMessage", async (data) => {
        try {
            // DB'ye kaydet
            await db.query(
                "INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)",
                [data.sender_id, data.receiver_id, data.message]
            )

            const receiverSocketId = onlineUsers.get(data.receiver_id)

            // Alıcı varsa sadece ona gönder
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("receiveMessage", data)
            }

            // Gönderenin ekranına da göster
            socket.emit("receiveMessage", data)

        } catch (err) {
            console.error("Mesaj DB'ye kaydedilemedi:", err)
            socket.emit("errorMessage", { error: "Mesaj kaydedilemedi" })
        }
    })

    socket.on("disconnect", () => {
        onlineUsers.forEach((value, key) => {
            if (value === socket.id) onlineUsers.delete(key)
        })
        console.log("Kullanıcı ayrıldı:", socket.id)
    })
})

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const corsOptions = {
    origin: '*', 
    methods: 'GET,POST,DELETE', 
    allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/clients', clientRoutes)
app.use('/api/admins', adminRoutes) 
app.use('/api/chat', chatRoutes) // chat route ekledik

// http server üzerinden başlat
httpServer.listen(PORT, () => {
    console.log(`Server ${PORT} portunda başladı.`)
})
