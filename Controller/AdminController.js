import db from '../database/DB.js'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import fs from "fs"
import path from "path"
import axios from "axios";

dotenv.config()
const JWT_SECRET = process.env.JWT_SECRET


export const AdminLogin = async (req, res) => {
  console.log("🔵 AdminLogin çağrıldı");
  console.log("📦 Request body:", req.body);
  
  const { client_name, password } = req.body;

  
  if (!client_name || !password) {
    console.log(" Eksik bilgi: client_name veya password yok");
    return res.status(400).json({ message: "Hiçbir alan boş olamaz" });
  }

  try {
    console.log(" Database sorgusu yapılıyor...");
    console.log(" Sorgu: SELECT * FROM admins WHERE client_name=$1 AND password=$2");
    console.log(" Parametreler:", [client_name, password]);

    const result = await db.query(
      'SELECT * FROM admins WHERE client_name=$1 AND password=$2',
      [client_name, password]
    );

    console.log("Database sorgusu tamamlandı");
    console.log(" Sonuç satır sayısı:", result.rows.length);

    if (result.rows.length === 0) {
      console.log(" Kullanıcı bulunamadı");
      return res.status(401).json({ message: 'Böyle bir kullanıcı bulunamadı' });
    }

    const user = result.rows[0];
    console.log("✅ Kullanıcı bulundu:", user);

 
    const token = jwt.sign(
      { id: user.id, client_name: user.client_name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(" Token oluşturuldu:", token);

 
    res.json({
      message: 'Giriş başarılı',
      token,
      user: { 
        id: user.id, 
        clientName: user.client_name, 
        role: user.role 
      }
    });

    console.log(" Login başarılı, response gönderildi");

  } catch (err) {
    console.error(" HATA:", err);
    console.error(" Hata detayı:", err.message);
    console.error(" Hata stack:", err.stack);
    
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};


export const GetAllClients = async (req, res) => {
  try {
    if (req.role !== "admin") {
      return res.status(403).json({ message: "Yetkisiz erişim" });
    }

    const result = await db.query(
      "SELECT id, kullanici_adi, gender, role, photo_base64 FROM clients WHERE approved=false ORDER BY id ASC"
    );

    const users = result.rows.map(user => ({
      id: user.id,
      clientName: user.kullanici_adi,
      gender: user.gender,
      role: user.role,
      photoUrl: user.photo_base64 
        ? `http://10.121.78.245:3000/uploads/${user.photo_base64}`
        : null
    }));


    console.log("Frontend'e gidecek users:", users);

    return res.status(200).json({
      message: "Tüm kullanıcılar getirildi",
      users
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
};


export const DeleteClient = async (req, res) => {
  try {

    if (req.role !== "admin") {
      return res.status(403).json({ message: "Yetkisiz erişim" });
    }

    const clientId = req.params.id;

  
    const result = await db.query("DELETE FROM clients WHERE id=$1 RETURNING *", [clientId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    console.log(` Kullanıcı ${clientId} silindi`);

    res.status(200).json({ message: "Kullanıcı silindi", deletedClient: result.rows[0] });
  } catch (error) {
    console.error(" DeleteClient Hatası:", error);
    res.status(500).json({ message: "Sunucu hatası" });
  }
};



export const ApproveClient = async (req, res) => {
  try {
    if (req.role !== "admin") {
      return res.status(403).json({ message: "Yetkisiz erişim" })
    }

    const clientId = req.params.id

    // Kullanıcı bilgilerini al (fotoğraf yolu için)
    const clientResult = await db.query(
      "SELECT photo_base64 FROM clients WHERE id=$1",
      [clientId]
    )

    if (clientResult.rowCount === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" })
    }

    const photoFile = clientResult.rows[0].photo_base64

    // Kullanıcıyı onayla
    await db.query("UPDATE clients SET approved=true WHERE id=$1", [clientId])

    // Fotoğrafı uploads klasöründen sil
    if (photoFile) {
      const filePath = path.join(process.cwd(), "uploads", photoFile)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log("Fotoğraf silindi (onay sonrası):", filePath)
      }
    }

    console.log(`Kullanıcı ${clientId} onaylandı`)
    res.status(200).json({ message: "Kullanıcı onaylandı" })
  } catch (error) {
    console.error("ApproveClient Hatası:", error)
    res.status(500).json({ message: "Sunucu hatası" })
  }
}







export const DeleteClientAndBanDevice = async (req, res) => {
  try {
    console.log("DeleteClientAndBanDevice çağrıldı, req.params:", req.params)
    console.log("Kullanıcı rolü:", req.role)

    if (req.role !== "admin") {
      console.log("Yetkisiz erişim tespit edildi")
      return res.status(403).json({ message: "Yetkisiz erişim" })
    }

    const clientId = req.params.id
    console.log("Silinecek clientId:", clientId)

    // Kullanıcı bilgilerini al (device_id + fotoğraf)
    const clientResult = await db.query(
      "SELECT device_id, photo_base64 FROM clients WHERE id=$1",
      [clientId]
    )

    if (clientResult.rowCount === 0) {
      console.log("Kullanıcı bulunamadı:", clientId)
      return res.status(404).json({ message: "Kullanıcı bulunamadı" })
    }

    const deviceId = clientResult.rows[0].device_id
    const photoFile = clientResult.rows[0].photo_base64
    console.log("Kullanıcının device_id'si:", deviceId)

    // Kullanıcıyı sil
    const deleteResult = await db.query(
      "DELETE FROM clients WHERE id=$1 RETURNING *",
      [clientId]
    )
    console.log("Silinen kullanıcı:", deleteResult.rows[0])

    // Fotoğrafı uploads klasöründen sil
    if (photoFile) {
      const filePath = path.join(process.cwd(), "uploads", photoFile)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log("Fotoğraf silindi:", filePath)
      }
    }

    // Cihazı banla
    if (deviceId) {
      await db.query(
        "INSERT INTO banned_devices(device_id) VALUES($1) ON CONFLICT DO NOTHING",
        [deviceId]
      )
      console.log("Cihaz banlandı:", deviceId)
    } else {
      console.log("Banlanacak cihaz yok")
    }

    res.status(200).json({
      message: "Kullanıcı silindi, cihaz banlandı ve fotoğraf kaldırıldı",
      deletedClient: deleteResult.rows[0],
    })
  } catch (error) {
    console.error("DeleteClientAndBanDevice Hatası:", error)
    res.status(500).json({ message: "Sunucu hatası" })
  }
}

