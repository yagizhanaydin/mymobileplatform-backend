import express from 'express';
import { DeleteYorum } from '../Controller/CommentController.js';
import authenticateToken from '../Middlewares/AuthMiddlewares.js';

const router = express.Router();

router.delete('/yorumlar/:yorumId', authenticateToken, DeleteYorum);

export default router;
