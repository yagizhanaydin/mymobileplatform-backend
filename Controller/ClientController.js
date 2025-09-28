import db from '../database/DB.js'
import bcrypt from 'bcrypt'
import path from 'path'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { containsBannedWord } from "../utils/bannedWordsCheck.js"  


dotenv.config()
const JWT_SECRET = process.env.JWT_SECRET

export const ClientRegister = async (req, res) => {
  try {
    const { client_name, password, gender, androidId } = req.body
    const file = req.file

    if (!client_name || !password || !gender || !file || !androidId) {
      return res.status(400).json({ message: "Eksik alanlar var!" })
    }


    if (containsBannedWord(client_name)) {
      console.log("Yasaklı kelime bulundu:", client_name)
      return res.status(400).json({ message: "Kullanıcı adı yasaklı kelime içeriyor!" })
    }

 
    const banned = await db.query(
      "SELECT * FROM banned_devices WHERE device_id = $1",
      [androidId]
    )
    if (banned.rows.length > 0) {
      return res.status(403).json({ message: "Bu cihaz banlı!" })
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
      "INSERT INTO clients (kullanici_adi, password, gender, photo_base64, device_id) VALUES ($1, $2, $3, $4, $5)",
      [client_name, hashedPassword, gender, photo_path, androidId]
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
        const { city, issue, target_gender } = req.body; 
        const clientId = req.userId;

        if (!city || !issue || !target_gender) {
            return res.status(400).json({ success: false, message: "İl, sorun ve hedef kitle alanları boş olamaz!" });
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

        const validGenders = ["male", "female", "both"];
        if (!validGenders.includes(target_gender)) {
            return res.status(400).json({ success: false, message: "Hedef kitle 'male', 'female' veya 'both' olmalıdır!" });
        }

        const result = await db.query(
            "INSERT INTO ilanlar (client_id, city, issue, target_gender) VALUES ($1, $2, $3, $4) RETURNING *",
            [clientId, city, issue, target_gender]
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
    const { city, issue, id } = req.query;
    const userId = parseInt(req.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Geçersiz userId" });
    }

    // Kullanıcının cinsiyetini al
    const userResult = await db.query("SELECT gender FROM clients WHERE id=$1", [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }
    let userGender = userResult.rows[0].gender;

    // Mapping: Türkçe → İngilizce
    const genderMap = { 'Erkek': 'male', 'Kadın': 'female', 'both': 'both', 'Both': 'both' };
    userGender = genderMap[userGender] || 'both'; // default 'both'  

    // Ana query
    let query = `
      SELECT i.id, i.city, i.issue, i.created_at, 
             c.kullanici_adi, c.gender, i.target_gender
      FROM ilanlar i
      JOIN clients c ON i.client_id = c.id
    `;

    const params = [];
    const conditions = [];

    if (id) {
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

    // Gender filter
    params.push(userGender);
    conditions.push(`(i.target_gender = 'both' OR i.target_gender = $${params.length})`);

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY i.created_at DESC";

    console.log("IlanShow Query:", query, params);

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error("IlanShow Hata:", err);
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
    console.log('DB UPSERT Sorgusu hazırlanıyor...');

    const queryText = `
      INSERT INTO locations2 (client_id, latitude, longitude, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (client_id)
      DO UPDATE SET 
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        created_at = EXCLUDED.created_at
    `;

    const values = [req.userId, latitude, longitude, timestamp || new Date()];

    console.log('Query:', queryText);
    console.log('Values:', values);

    await db.query(queryText, values);

    console.log('Konum veritabanına kaydedildi veya güncellendi!');
    res.status(200).json({ success: true, message: 'Konum kaydedildi veya güncellendi' });
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


    jwt.verify(token, JWT_SECRET);

   
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




export const AddFriends = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) return res.status(401).json({ message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const sender_id = decoded.id; 
        const { friendId: receiver_id } = req.body;

        if (sender_id === receiver_id) {
            return res.status(400).json({ message: "Kendi kendine arkadaşlık isteği atamazsın." });
        }

        const checkQuery = `SELECT * FROM friends WHERE sender_id = $1 AND receiver_id = $2`;
        const existing = await db.query(checkQuery, [sender_id, receiver_id]);

        if (existing.rows.length > 0) {
            return res.status(400).json({ message: "Zaten bu kişiye arkadaşlık isteği göndermişsin." });
        }

        const insertQuery = `INSERT INTO friends (sender_id, receiver_id) VALUES ($1, $2) RETURNING *`;
        const result = await db.query(insertQuery, [sender_id, receiver_id]);

        return res.status(200).json({ message: "Arkadaşlık isteği gönderildi.", data: result.rows[0] });

    } catch (error) {
        console.error("AddFriends error:", error);
        return res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};


export const ShowFriendRequest = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        console.log("ShowFriendRequest tetiklendi, Auth Header:", authHeader); // LOG

        if (!authHeader) return res.status(401).json({ message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        console.log("Decoded userId:", userId); // LOG

        const query = `
            SELECT f.id AS request_id, f.sender_id, c.kullanici_adi AS sender_name, f.status, f.created_at
            FROM friends f
            JOIN clients c ON f.sender_id = c.id
            WHERE f.receiver_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `;

        const result = await db.query(query, [userId]);

        console.log("Query result rows:", result.rows); // LOG

        return res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("ShowFriendRequest error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};


export const ResponseFriendRequest = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        console.log("🔹 ResponseFriendRequest tetiklendi, Auth Header:", authHeader);

        if (!authHeader) return res.status(401).json({ success: false, message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        console.log("🔹 Decoded userId:", userId);

        const { requestId, action } = req.body;
        console.log("🔹 Gelen body:", req.body);

        if (!requestId || !action) {
            return res.status(400).json({ success: false, message: "Eksik veri" });
        }

        const status = action === "accepted" ? "accepted" : "rejected";

        const updateQuery = `
            UPDATE friends
            SET status = $1
            WHERE id = $2 AND receiver_id = $3
            RETURNING *
        `;
        console.log("🔹 UPDATE sorgusu hazırlanıyor:", updateQuery);
        console.log("🔹 Parametreler:", [status, requestId, userId]);

        const result = await db.query(updateQuery, [status, requestId, userId]);
        console.log("🔹 Update sonucu rowCount:", result.rowCount);
        console.log("🔹 Update sonucu rows:", result.rows);

        if (result.rowCount === 0) {
            console.log(" Eşleşen istek bulunamadı! requestId ve receiver_id eşleşmesini kontrol et.");
            return res.status(404).json({ success: false, message: "İstek bulunamadı" });
        }

        console.log(` İstek ${status} edildi. requestId: ${requestId}, userId: ${userId}`);
        return res.status(200).json({
            success: true,
            message: `İstek ${status === "accepted" ? "kabul edildi" : "reddedildi"}`
        });

    } catch (error) {
        console.error(" ResponseFriendRequest error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};


export const GetFriendsSayi = async (req, res) => {
    try {
       
        const authHeader = req.header("Authorization");
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Token yok"
            });
        }

      
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // --- Sorgu: sadece 'accepted' olanları say ---
        const query = `
            SELECT COUNT(*) AS count
            FROM friends
            WHERE status = 'accepted'
              AND (sender_id = $1 OR receiver_id = $1)
        `;

        const result = await db.query(query, [userId]);

        return res.status(200).json({
            success: true,
            count: parseInt(result.rows[0].count, 10)
        });

    } catch (error) {
        console.error("GetFriendsSayi error:", error);
        return res.status(500).json({
            success: false,
            message: "Sunucu hatası",
            error: error.message
        });
    }
};



export const DeleteClient = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) return res.status(401).json({ success: false, message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { friendId } = req.params; 
        if (!friendId) {
            return res.status(400).json({ success: false, message: "Eksik friendId" });
        }

        const deleteQuery = `
            DELETE FROM friends
            WHERE (sender_id = $1 AND receiver_id = $2)
               OR (sender_id = $2 AND receiver_id = $1)
        `;

        const result = await db.query(deleteQuery, [userId, friendId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Arkadaş bulunamadı" });
        }

        return res.status(200).json({ success: true, message: "Arkadaş silindi" });

    } catch (error) {
        console.error("DeleteClient error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};




export const GetFriendsList = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) return res.status(401).json({ success: false, message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const query = `
            SELECT 
                f.id,
                CASE 
                    WHEN f.sender_id = $1 THEN f.receiver_id
                    ELSE f.sender_id
                END AS friendId,
                CASE 
                    WHEN f.sender_id = $1 THEN c2.kullanici_adi
                    ELSE c1.kullanici_adi
                END AS friendName,
                f.status
            FROM friends f
            JOIN clients c1 ON f.sender_id = c1.id
            JOIN clients c2 ON f.receiver_id = c2.id
            WHERE f.status = 'accepted' AND (f.sender_id = $1 OR f.receiver_id = $1)
        `;

        const result = await db.query(query, [userId]);

        console.log("GetFriendsList result:", result.rows); // <-- burası loglama

        return res.status(200).json({ success: true, data: result.rows });

    } catch (error) {
        console.error("GetFriendsList error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};




export const ShowDangerLocations = async (req, res) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Token yok" });
    }

    const token = authHeader.split(" ")[1]; // Bearer TOKEN
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const query = `
      SELECT 
        c.id AS friendId,
        c.kullanici_adi AS friendName,
        l.latitude,
        l.longitude,
        l.created_at
      FROM friends f
      JOIN clients c 
        ON (c.id = f.sender_id OR c.id = f.receiver_id)
      JOIN locations2 l 
        ON l.client_id = c.id
      WHERE f.status = 'accepted'
        AND c.id != $1             -- kendini hariç tut
        AND ($1 = f.sender_id OR $1 = f.receiver_id)  -- sadece arkadaş ilişkilerini al
      ORDER BY l.created_at DESC;
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      locations: result.rows,
    });

  } catch (error) {
    console.error("ShowDangerLocations error:", error);
    return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
  }
};



export const UserNameAndById = async (req, res) => {
  try {
    const receiverId = parseInt(req.params.id);
    if (isNaN(receiverId)) return res.status(400).json({ message: "Geçersiz id" });

    const result = await db.query(
      "SELECT kullanici_adi FROM clients WHERE id=$1",
      [receiverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    return res.status(200).json({
      message: "Kullanıcı bulundu",
      client_name: result.rows[0].kullanici_adi  
    });

  } catch (error) {
    console.error("UserNameAndById error:", error);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
};
