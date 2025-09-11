import db from '../database/DB.js'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

import fs from "fs"
import path from "path"


dotenv.config()
const JWT_SECRET = process.env.JWT_SECRET


export const AdminLogin = async (req, res) => {
  console.log("🔵 AdminLogin çağrıldı");
  console.log("📦 Request body:", req.body);
  
  const { client_name, password } = req.body;

  // Body kontrolü
  if (!client_name || !password) {
    console.log("❌ Eksik bilgi: client_name veya password yok");
    return res.status(400).json({ message: "Hiçbir alan boş olamaz" });
  }

  try {
    console.log("🔍 Database sorgusu yapılıyor...");
    console.log("📊 Sorgu: SELECT * FROM admins WHERE client_name=$1 AND password=$2");
    console.log("📋 Parametreler:", [client_name, password]);

    const result = await db.query(
      'SELECT * FROM admins WHERE client_name=$1 AND password=$2',
      [client_name, password]
    );

    console.log("✅ Database sorgusu tamamlandı");
    console.log("📊 Sonuç satır sayısı:", result.rows.length);

    if (result.rows.length === 0) {
      console.log("❌ Kullanıcı bulunamadı");
      return res.status(401).json({ message: 'Böyle bir kullanıcı bulunamadı' });
    }

    const user = result.rows[0];
    console.log("✅ Kullanıcı bulundu:", user);

    // JWT token oluştur
    const token = jwt.sign(
      { id: user.id, client_name: user.client_name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log("✅ Token oluşturuldu:", token);

    // Başarılı yanıt
    res.json({
      message: 'Giriş başarılı',
      token,
      user: { 
        id: user.id, 
        clientName: user.client_name, 
        role: user.role 
      }
    });

    console.log("✅ Login başarılı, response gönderildi");

  } catch (err) {
    console.error("❌ HATA:", err);
    console.error("❌ Hata detayı:", err.message);
    console.error("❌ Hata stack:", err.stack);
    
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};


export const GetAllClients = async (req, res) => {
  try {
    if (req.role !== "admin") {
      return res.status(403).json({ message: "Yetkisiz erişim" });
    }

    const result = await db.query(
      "SELECT id, kullanici_adi, gender, role, photo_base64 FROM clients ORDER BY id ASC"
    );

    const users = result.rows.map(user => ({
      id: user.id,
      clientName: user.kullanici_adi,
      gender: user.gender,
      role: user.role,
      photoUrl: user.photo_base64 
        ? `http://localhost:3000/uploads/${user.photo_base64}` 
        : null
    }));

    return res.status(200).json({
      message: "Tüm kullanıcılar getirildi",
      users
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
};
