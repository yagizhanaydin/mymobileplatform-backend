import express from 'express'
import { AdminLogin, ApproveClient, DeleteClient, GetAllClients } from '../Controller/AdminController.js'
import verifyToken from '../Middlewares/AuthMiddlewares.js'

const router = express.Router()

// Admin login
router.post('/login', AdminLogin)

// Admin panel: tüm kullanıcıları getir
router.get('/adminpanel', verifyToken, GetAllClients)

router.post('/approve/:id', verifyToken,ApproveClient)
router.delete('/delete/:id', verifyToken, DeleteClient)
export default router
