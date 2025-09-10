import db from '../database/DB.js'
import bcrypt from 'bcrypt'
import path from 'path'

export const ClientRegister = async (req, res) => {
  try {
    const { client_name, password, gender } = req.body
    const file = req.file

    if (!client_name || !password || !gender || !file) {
      return res.status(400).json({ message: "Eksik alanlar var!" })
    }

    // Aynı kullanıcı adı var mı kontrol
    const result = await db.query(
      "SELECT * FROM clients WHERE kullanici_adi = $1",
      [client_name]
    )

    if (result.rows.length > 0) {
      return res.status(400).json({ message: "Bu kullanıcı adı zaten alınmış." })
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10)

    // Fotoğraf ismini kaydet
    const photo_path = file.filename

    // Veritabanına kaydet
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
