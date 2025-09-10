import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

function verifyToken(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Access denied' });

 
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;          
    req.clientName = decoded.client_name; 
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export default verifyToken;
