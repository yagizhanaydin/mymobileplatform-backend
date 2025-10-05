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
        ? `http://10.147.226.245:3000/uploads/${user.photo_base64}`
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

   
    const clientResult = await db.query(
      "SELECT photo_base64 FROM clients WHERE id=$1",
      [clientId]
    )

    if (clientResult.rowCount === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" })
    }

    const photoFile = clientResult.rows[0].photo_base64

   
    await db.query("UPDATE clients SET approved=true WHERE id=$1", [clientId])

    
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


    const deleteResult = await db.query(
      "DELETE FROM clients WHERE id=$1 RETURNING *",
      [clientId]
    )
    console.log("Silinen kullanıcı:", deleteResult.rows[0])

    
    if (photoFile) {
      const filePath = path.join(process.cwd(), "uploads", photoFile)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log("Fotoğraf silindi:", filePath)
      }
    }

  
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



export const getComplaints = async (req, res) => {
    try {
        console.log("getComplaints çağrıldı"); // çağrı geldi mi kontrol
        const complaintsResult = await db.query(`
            SELECT 
                comp.id,
                comp.reason,
                comp.reported_by,
                comp.created_at,
                i.id AS ilan_id,
                i.city,
                i.issue,
                c.kullanici_adi AS ilan_sahibi
            FROM complaints comp
            JOIN ilanlar i ON comp.ilan_id = i.id
            JOIN clients c ON i.client_id = c.id
            ORDER BY comp.created_at DESC
        `);

        console.log("DB’den gelen sonuç:", complaintsResult.rows);

        return res.status(200).json({
            success: true,
            data: complaintsResult.rows
        });

    } catch (error) {
        console.error("Şikayetleri çekme hatası:", error);
        return res.status(500).json({
            success: false,
            message: "Sunucu hatası"
        });
    }
};



export const deleteComplaint = async (req, res) => {
    try {
        const complaintId = req.params.id;

        // 1️⃣ Önce şikayeti bul (ilan_id lazım olacak)
        const complaintResult = await db.query(
            'SELECT ilan_id FROM complaints WHERE id = $1',
            [complaintId]
        );

        if (complaintResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Şikayet bulunamadı!"
            });
        }

        const ilanId = complaintResult.rows[0].ilan_id;

        // 2️⃣ İlanı sil → complaints otomatik silinecek
        const deleteIlan = await db.query(
            'DELETE FROM ilanlar WHERE id = $1 RETURNING *',
            [ilanId]
        );

        return res.status(200).json({
            success: true,
            message: "İlan ve ilgili şikayet(ler) silindi!",
            data: deleteIlan.rows[0]
        });

    } catch (error) {
        console.error("Şikayet/İlan silme hatası:", error);
        return res.status(500).json({
            success: false,
            message: "Sunucu hatası"
        });
    }
};


export const GetSikayetYorum = async (req, res) => {
    try {
        const query = `
            SELECT 
                ys.id AS sikayet_id,
                ys.reason AS sikayet_sebebi,
                ys.created_at AS sikayet_tarihi,
                y.id AS yorum_id,
                y.comment AS yorum_icerigi,
                y.ilan_id,
                COALESCE(c.kullanici_adi, 'Bilinmiyor') AS yorum_sahibi
            FROM yorum_sikayetleri ys
            JOIN yorumlar y ON y.id = ys.yorum_id
            LEFT JOIN clients c ON c.id = y.client_id
            ORDER BY ys.created_at DESC;
        `;
        const result = await db.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
};


export const deleteComment = async (req, res) => {
    try {
        const commentId = req.params.id;

        const commentResult = await db.query(
            "SELECT * FROM yorumlar WHERE id = $1",
            [commentId]
        );

        if (commentResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Yorum bulunamadı!" });
        }

        await db.query("DELETE FROM yorumlar WHERE id = $1", [commentId]);

        res.json({ success: true, message: "Yorum ve ilgili şikayetler silindi!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
};
