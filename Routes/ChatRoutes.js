import express from 'express';
import { sendMessage, getMessages, deleteConversation } from '../Controller/ChatController.js';
import { getConversations } from '../Controller/ChatController.js';
import verifyToken from '../Middlewares/AuthMiddlewares.js';

const router = express.Router();

router.post('/send', verifyToken,sendMessage);         // mesaj gönder
router.get('/list', verifyToken,getMessages);        
router.get('/conversations',verifyToken, getConversations);
router.delete('/delete/:id', verifyToken, deleteConversation);
export default router;
