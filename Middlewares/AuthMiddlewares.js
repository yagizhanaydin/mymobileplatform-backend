import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  console.log('verifyToken tetiklendi, Auth Header:', authHeader);

  if (!authHeader) return res.status(401).json({ error: 'Access denied' });

  const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;

  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.clientName = decoded.client_name || null;
    req.role = decoded.role || 'client';
    next();
  } catch (error) {
    console.error('JWT doğrulama hatası:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export default verifyToken;
