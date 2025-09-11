import db from '../database/DB.js'
import bcrypt from 'bcrypt'
import path from 'path'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'



dotenv.config()
const JWT_SECRET = process.env.JWT_SECRET

export const ClientRegister = async (req, res) => {
  try {
    const { client_name, password, gender } = req.body
    const file = req.file

    if (!client_name || !password || !gender || !file) {
      return res.status(400).json({ message: "Eksik alanlar var!" })
    }

    
    const result = await db.query(
      "SELECT * FROM clients WHERE kullanici_adi = $1",
      [client_name]
    )

    if (result.rows.length > 0) {
      return res.status(400).json({ message: "Bu kullanıcı adı zaten alınmış." })
    }

    
    const hashedPassword = await bcrypt.hash(password, 10)

    
    const photo_path = file.filename

    
    await db.query(
      "INSERT INTO clients (kullanici_adi, password, gender, photo_base64) VALUES ($1, $2, $3, $4)",
      [client_name, hashedPassword, gender, photo_path]
    )

    return res.status(201).json({ message: "Kayıt başarılı!" })

  } catch (error) {
    console.error("Register error:", error)
    return res.status(500).json({ message: "Sunucu hatası" })
  }
}


export const ClientLogin = async (req, res) => {
  try {
    const { client_name, password } = req.body;

    if (!client_name || !password) {
      return res.status(400).json({ message: "Hiçbir alan boş olamaz" });
    }

    // Önce client tablosunda ara
    let result = await db.query(
      "SELECT * FROM clients WHERE kullanici_adi=$1",
      [client_name]
    );

    let role = "client";

    // Eğer client yoksa admin tablosunda ara
    if (result.rows.length === 0) {
      result = await db.query(
        "SELECT * FROM admins WHERE client_name=$1",
        [client_name]
      );
      role = "admin";
    }

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Böyle bir kullanıcı bulunamadı" });
    }

    const user = result.rows[0];

    // Şifre kontrolü: önce bcrypt, sonra düz metin
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (e) {
      console.warn("bcrypt ile kontrol edilemedi, düz metin denenecek");
    }

    if (!isMatch) {
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return res.status(400).json({ message: "Şifre yanlış" });
    }

    // Token oluştur
    const token = jwt.sign(
      {
        id: user.id,
        client_name: role === "client" ? user.kullanici_adi : user.client_name,
        role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Response
    return res.status(200).json({
      message: "Giriş başarılı",
      token,
      user: {
        id: user.id,
        client_name: role === "client" ? user.kullanici_adi : user.client_name,
        gender: user.gender || null,
        photo_base64: user.photo_base64 || null,
        role
      }
    });
  } catch (error) {
    console.error("ClientLogin error:", error);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
};


export const GetDataClient = async (req, res) => {
  try {
    const authHeader = req.header('Authorization')
    if (!authHeader) return res.status(401).json({ message: "Token yok" })

    const token = authHeader.split(' ')[1]
    if (!token) return res.status(401).json({ message: "Token yok" })

    const decoded = jwt.verify(token, JWT_SECRET)
    const userId = decoded.id

    const result = await db.query(
      "SELECT kullanici_adi, gender FROM clients WHERE id=$1",
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" })
    }

    const user = result.rows[0]

    return res.status(200).json({
      message: "Kullanıcı verileri başarıyla getirildi",
      user
    })

  } catch (error) {
    console.error("GetDataClient error:", error)
    return res.status(500).json({ message: "Sunucu hatası" })
  }
}
