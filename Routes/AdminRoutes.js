import express from 'express'
import { AdminLogin, ApproveClient, DeleteClientAndBanDevice, deleteComplaint, GetAllClients, getComplaints } from '../Controller/AdminController.js'
import verifyToken from '../Middlewares/AuthMiddlewares.js'

const router = express.Router()


router.post('/login', AdminLogin)


router.get('/adminpanel', verifyToken, GetAllClients)

router.post('/approve/:id', verifyToken,ApproveClient)

router.delete('/delete/:id', verifyToken, DeleteClientAndBanDevice)

router.get('/ilan', verifyToken, getComplaints);


router.delete('/ilansil/:id', verifyToken, deleteComplaint);
export default router
