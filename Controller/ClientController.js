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

  
    let result = await db.query(
      "SELECT * FROM clients WHERE kullanici_adi=$1",
      [client_name]
    );

    let role = "client";

    
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

  
    const token = jwt.sign(
      {
        id: user.id,
        client_name: role === "client" ? user.kullanici_adi : user.client_name,
        role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );


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



export const IlanKayit = async (req, res) => {
    try {
        const { city, issue } = req.body;

        // Token’dan client id'yi alıyoruz
        const clientId = req.userId;

        if (!city || !issue) {
            return res.status(400).json({ success: false, message: "İl ve sorun alanı boş olamaz!" });
        }

       
        const iller = [
            "Adana","Adıyaman","Afyon","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın",
            "Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale",
            "Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum",
            "Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Isparta","Mersin",
            "İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli",
            "Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş",
            "Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas",
            "Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat",
            "Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın",
            "Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"
        ];

        if (!iller.includes(city)) {
            return res.status(400).json({ success: false, message: "Geçerli bir il giriniz!" });
        }

        // İlanı eklerken client_id ile ilişkilendiriyoruz
        const result = await db.query(
            "INSERT INTO ilanlar (client_id, city, issue) VALUES ($1, $2, $3) RETURNING *",
            [clientId, city, issue]
        );

        return res.status(201).json({
            success: true,
            message: "İlan başarıyla kaydedildi!",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Sunucu hatası!" });
    }
};


export const IlanShow = async (req, res) => {
  try {
 const { city, issue } = req.query;

    // SELECT ile ilanları ve kullanıcı adlarını alıyoruz
    let query = `
      SELECT i.id, i.city, i.issue, i.created_at, c.kullanici_adi
      FROM ilanlar i
      JOIN clients c ON i.client_id = c.id
    `;

    const params = [];
    const conditions = [];

    if (city) {
      params.push(city);
      conditions.push(`i.city = $${params.length}`);
    }

    if (issue) {
      params.push(`%${issue}%`);
      conditions.push(`i.issue ILIKE $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY i.created_at DESC";

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
};