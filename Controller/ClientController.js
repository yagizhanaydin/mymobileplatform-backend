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
    const { city, issue, id } = req.query; // id ekledik

    let query = `
      SELECT i.id, i.city, i.issue, i.created_at, c.kullanici_adi, c.gender
      FROM ilanlar i
      JOIN clients c ON i.client_id = c.id
    `;

    const params = [];
    const conditions = [];

    if (id) { // id filtreleme
      params.push(id);
      conditions.push(`i.id = $${params.length}`);
    }

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


export const AddYorum = async (req, res) => {
  try {
    const { ilanId } = req.params;
    const { comment } = req.body;
    const clientId = req.userId;

    console.log("AddYorum çağrıldı:", { ilanId, comment, clientId });

    if (!comment) {
      console.log("Yorum boş geldi!");
      return res.status(400).json({ success: false, message: "Yorum boş olamaz!" });
    }

    // Yorum ekle
    const result = await db.query(
      `INSERT INTO yorumlar (ilan_id, client_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ilanId, clientId, comment]
    );

    console.log("Yorum eklendi:", result.rows[0]);

    // Kullanıcı bilgilerini almak için JOIN
    const yorumId = result.rows[0].id;
    const yorumFull = await db.query(
      `SELECT y.id, y.ilan_id, y.client_id, c.kullanici_adi, c.gender, y.comment, y.created_at
       FROM yorumlar y
       JOIN clients c ON y.client_id = c.id
       WHERE y.id=$1`,
      [yorumId]
    );

    console.log("Yorum detayları:", yorumFull.rows[0]);

    res.status(201).json({ success: true, data: yorumFull.rows[0] });

  } catch (error) {
    console.error("AddYorum error:", error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}


export const GetYorumlar = async (req, res) => {
  try {
    const { ilanId } = req.params;
    console.log("GetYorumlar çağrıldı:", { ilanId });

    const result = await db.query(
      `SELECT y.id, y.ilan_id, y.client_id, c.kullanici_adi, c.gender, y.comment, y.created_at
       FROM yorumlar y
       JOIN clients c ON y.client_id = c.id
       WHERE y.ilan_id=$1
       ORDER BY y.created_at DESC`,
      [ilanId]
    );

    console.log("GetYorumlar sonucu:", result.rows);

    res.status(200).json({ success: true, data: result.rows });

  } catch (error) {
    console.error("GetYorumlar error:", error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
}


export const MyIlanlar = async (req, res) => {
  try {
    const clientId = req.userId; 
    console.log("MyIlanlar çağrıldı, clientId:", clientId);

    
    const result = await db.query(
      `SELECT i.id, i.city, i.issue, i.created_at, c.kullanici_adi, c.gender
       FROM ilanlar i
       JOIN clients c ON i.client_id = c.id
       WHERE i.client_id = $1
       ORDER BY i.created_at DESC`,
      [clientId]
    );

    console.log("Sorgu sonucu:", result.rows);

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("MyIlanlar error:", error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
};


export const deleteIlan = async (req, res) => {
    try {
        const ilanId = parseInt(req.params.id);
        const clientId = req.userId; 

        console.log("DELETE İstek geldi:", { ilanId, clientId });

        const checkResult = await db.query(
            "SELECT * FROM ilanlar WHERE id=$1 AND client_id=$2",
            [ilanId, clientId]
        );

        console.log("CheckResult:", checkResult.rows);

        if (checkResult.rows.length === 0) {
            console.log("Silme yetkisi yok");
            return res.status(403).json({ success: false, message: "Bu ilana silme yetkiniz yok" });
        }

        await db.query("DELETE FROM ilanlar WHERE id=$1", [ilanId]);
        console.log("İlan başarıyla silindi:", ilanId);

        res.status(200).json({ success: true, message: "İlan başarıyla silindi" });

    } catch (error) {
        console.error("deleteIlan error:", error);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};




export const PostLocation = async (req, res) => {
  const { latitude, longitude, timestamp } = req.body;

  console.log('--- ACIL KONUM REQUEST GELDI ---');
  console.log('ClientID:', req.userId);
  console.log('Latitude:', latitude);
  console.log('Longitude:', longitude);
  console.log('Timestamp:', timestamp);

  if (latitude === undefined || longitude === undefined) {
    console.warn('Eksik veri var!');
    return res.status(400).json({ success: false, message: 'Eksik veri var' });
  }

  try {
    console.log('DB INSERT Sorgusu hazırlanıyor...');
    const queryText = 'INSERT INTO locations2 (client_id, latitude, longitude, created_at) VALUES ($1, $2, $3, $4)';
    const values = [req.userId, latitude, longitude, timestamp || new Date()];

    console.log('Query:', queryText);
    console.log('Values:', values);

    await db.query(queryText, values);

    console.log('Konum veritabanına kaydedildi!');
    res.status(200).json({ success: true, message: 'Konum kaydedildi' });
  } catch (err) {
    console.error('Veritabanı hatası:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};





export const getAllUsers = async (req, res) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Token yok" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token yok" });
    }

    // Token doğrulama
    jwt.verify(token, JWT_SECRET);

    // Sadece kullanici_adi alanını çekiyoruz
    const result = await db.query(
      `SELECT id, kullanici_adi 
       FROM clients 
       ORDER BY kullanici_adi ASC`
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
};
