import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import clientRoutes from './Routes/ClientRoutes.js'
import adminRoutes from './Routes/AdminRoutes.js' 
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
const PORT = process.env.PORT || 3000

// Uploads klasörünü statik yap
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

app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda başladı.`)
})
