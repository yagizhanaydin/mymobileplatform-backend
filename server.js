import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import clientRoutes from './Routes/ClientRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const corsOptions = {
    origin: '*', 
    methods: 'GET,POST',
    allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static('uploads'))

app.use('/api/clients', clientRoutes)

app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda başarılı bir şekilde başlatıldı.`)
})
