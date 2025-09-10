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
    const { client_name, password } = req.body

    if (!client_name || !password) {
      return res.status(400).json({ message: "Hiçbir alan boş olamaz" })
    }

   
    const result = await db.query(
      "SELECT * FROM clients WHERE kullanici_adi=$1",
      [client_name]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Böyle bir kullanıcı bulunamadı" })
    }

    const user = result.rows[0]

    // Admin onayı kontrolü
    if (!user.approved) {
      return res.status(403).json({ message: "Kullanıcı henüz admin onayını almadı." })
    }

    
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Şifre yanlış" })
    }

  
    const token = jwt.sign(
      { id: user.id, client_name: user.kullanici_adi },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      message: "Giriş başarılı",
      token,
      user: {
        id: user.id,
        client_name: user.kullanici_adi,
        gender: user.gender,
        photo_base64: user.photo_base64
      }
    })

  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).json({ message: "Sunucu hatası" })
  }
}