import express from 'express';
import { sendMessage, getMessages } from '../Controller/ChatController.js';
import { getConversations } from '../Controller/ChatController.js';
import verifyToken from '../Middlewares/AuthMiddlewares.js';

const router = express.Router();

router.post('/send', verifyToken,sendMessage);         // mesaj gönder
router.get('/list', verifyToken,getMessages);          // iki kişi arasındaki mesajları getir
router.get('/conversations',verifyToken, getConversations);

export default router;
