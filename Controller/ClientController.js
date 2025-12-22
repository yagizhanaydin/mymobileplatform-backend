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
    const { client_name, password, gender, androidId, securityQuestion, securityAnswer } = req.body;
    const file = req.file;

   
    console.log("ClientRegister input:", {
      client_name,
      gender,
      androidId,
      securityQuestion,
      securityAnswer,
      file: file ? file.filename : null
    });

    if (!client_name || !password || !gender || !file || !androidId || !securityQuestion || !securityAnswer) {
      return res.status(400).json({ message: "Eksik alanlar var!" });
    }

    if (containsBannedWord(client_name)) {
      return res.status(400).json({ message: "Kullanıcı adı yasaklı kelime içeriyor!" });
    }

    const banned = await db.query(
      "SELECT * FROM banned_devices WHERE device_id = $1",
      [androidId]
    );
    if (banned.rows.length > 0) {
      return res.status(403).json({ message: "Bu cihaz banlı!" });
    }

    const result = await db.query(
      "SELECT * FROM clients WHERE kullanici_adi = $1",
      [client_name]
    );
    if (result.rows.length > 0) {
      return res.status(400).json({ message: "Bu kullanıcı adı zaten alınmış." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const photo_path = file.filename;

    await db.query(
      `INSERT INTO clients 
      (kullanici_adi, password, gender, photo_base64, device_id, security_question, security_answer) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [client_name, hashedPassword, gender, photo_path, androidId, securityQuestion, securityAnswer]
    );

    return res.status(201).json({ message: "Kayıt başarılı!" });

  } catch (error) {
    console.error("ClientRegister error:", error);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
}


export const ClientLogin = async (req, res) => {
  try {
    const { client_name, password, device_id } = req.body;
    console.log(`[LOGIN ATTEMPT] Kullanıcı: ${client_name}, DeviceID: ${device_id}`);

    if (!client_name || !password || !device_id) {
      console.log("[LOGIN ERROR] Alanlar boş");
      return res.status(400).json({ message: "Alanlar boş olamaz" });
    }

    // Yasaklı cihaz kontrolü
    const bannedResult = await db.query(
      "SELECT * FROM banned_devices WHERE device_id=$1",
      [device_id]
    );
    if (bannedResult.rows.length > 0) {
      console.log(`[LOGIN BLOCKED] Yasaklı cihaz: ${device_id}`);
      return res.status(403).json({ message: "Bu cihaz yasaklı" });
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
      console.log(`[LOGIN ERROR] Kullanıcı bulunamadı: ${client_name}`);
      return res.status(400).json({ message: "Böyle bir kullanıcı bulunamadı" });
    }

    const user = result.rows[0];
    let isMatch = false;

   
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch {
      console.warn("bcrypt kontrol edilemedi, düz metin deneniyor");
    }

    if (!isMatch) isMatch = password === user.password;
    if (!isMatch) {
      console.log(`[LOGIN ERROR] Şifre yanlış: ${client_name}`);
      return res.status(400).json({ message: "Şifre yanlış" });
    }

    
    const token = jwt.sign(
      { id: user.id, client_name: role === "client" ? user.kullanici_adi : user.client_name, role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[LOGIN SUCCESS] Kullanıcı: ${client_name}, Role: ${role}, DeviceID: ${device_id}`);

    // YANIT KISMI: Android tarafının beklediği device_id bilgisini ekledik
    return res.status(200).json({
      message: "Giriş başarılı",
      token,
      device_id: device_id, // Android tarafı bu değeri alıp "gösterildi mi?" kontrolü yapacak
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



// 1. YORUM EKLEME
export const AddYorum = async (req, res) => {
  try {
    const { ilanId } = req.params; 
    const { comment } = req.body;
    
    // Senin diğer fonksiyonlarında kullandığın yapı: req.userId
    const myUserId = req.userId; 

    console.log("AddYorum tetiklendi:", { ilanId, myUserId, comment });

    if (!myUserId) {
        return res.status(401).json({ success: false, message: "Yetkisiz erişim!" });
    }

    // DB Kaydı
    const insertResult = await db.query(
      `INSERT INTO yorumlar (ilan_id, client_id, comment) 
       VALUES ($1, $2, $3) RETURNING *`,
      [ilanId, myUserId, comment]
    );

    const newCommentId = insertResult.rows[0].id;

    // Android tarafında anında gözükmesi için detaylı çekiyoruz
    const fullComment = await db.query(
      `SELECT 
        y.id, y.ilan_id, y.client_id, c.kullanici_adi, c.gender, y.comment, y.created_at,
        TRUE AS "isMine" 
       FROM yorumlar y
       JOIN clients c ON y.client_id = c.id
       WHERE y.id = $1`,
      [newCommentId]
    );

    res.status(201).json({ 
      success: true, 
      data: fullComment.rows[0] 
    });

  } catch (error) {
    console.error("AddYorum Hatası:", error.message);
    res.status(500).json({ success: false, message: "Yorum kaydedilemedi." });
  }
};

// 2. YORUMLARI GETİRME
export const GetYorumlar = async (req, res) => {
  try {
    const { ilanId } = req.params;
    const myUserId = req.userId; // verifyToken'dan gelen ID

    console.log("GetYorumlar çağrıldı, İlan:", ilanId, "Kullanıcı:", myUserId);

    const result = await db.query(
      `SELECT 
        y.id, 
        y.ilan_id, 
        y.client_id, 
        c.kullanici_adi, 
        c.gender, 
        y.comment, 
        y.created_at,
        (y.client_id = $2) AS "isMine" 
       FROM yorumlar y
       JOIN clients c ON y.client_id = c.id
       WHERE y.ilan_id = $1
       ORDER BY y.created_at DESC`,
      [ilanId, myUserId || 0] // Kullanıcı login değilse 0 gönderiyoruz ki hata vermesin
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GetYorumlar error:", error);
    res.status(500).json({ success: false, message: "Yorumlar getirilemedi." });
  }
};


export const DeleteYorum = async (req, res) => {
  try {
    const { yorumId } = req.params;
    const myUserId = req.userId;

    const result = await db.query(
      "DELETE FROM yorumlar WHERE id = $1 AND client_id = $2 RETURNING *",
      [yorumId, myUserId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ success: false, message: "Bu yorumu silme yetkiniz yok!" });
    }

    res.status(200).json({ success: true, message: "Yorum başarıyla silindi." });
  } catch (error) {
    console.error("DeleteYorum error:", error);
    res.status(500).json({ success: false, message: "Silme işlemi başarısız." });
  }
};



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

   
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUserId = parseInt(decoded.id); 

    console.log("getAllUsers request => currentUserId:", currentUserId, typeof currentUserId);

    const result = await db.query(
      `SELECT id, kullanici_adi 
       FROM clients 
       WHERE id != $1
       ORDER BY kullanici_adi ASC`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error("getAllUsers error:", {
      message: error.message,
      stack: error.stack
    });
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

        // Kullanıcıların cinsiyetlerini çek
        const userQuery = `SELECT id, gender FROM clients WHERE id = ANY($1::int[])`;
        const userResult = await db.query(userQuery, [[sender_id, receiver_id]]);
        const senderGender = userResult.rows.find(u => u.id === sender_id)?.gender;
        const receiverGender = userResult.rows.find(u => u.id === receiver_id)?.gender;
        if (!senderGender || !receiverGender) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        // Receiver’ın ayarını kontrol et
        const receiverSettingsQuery = `
            SELECT block_opposite_gender_follow 
            FROM user_settings 
            WHERE user_id = $1
        `;
        const receiverSettingsResult = await db.query(receiverSettingsQuery, [receiver_id]);
        const blockOpposite = receiverSettingsResult.rows[0]?.block_opposite_gender_follow ?? false;

        if (blockOpposite && senderGender !== receiverGender) {
            return res.status(403).json({ message: "Bu kullanıcı karşı cinsin arkadaşlık isteğine kapalı." });
        }

        // Engellenmiş kullanıcı kontrolü
        const blockedQuery = `SELECT * FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`;
        const blocked = await db.query(blockedQuery, [sender_id, receiver_id]);
        if (blocked.rows.length > 0) {
            return res.status(403).json({ message: "Bu kullanıcıyı engellediğin için istek gönderemezsin." });
        }

        // Arkadaşlık isteğini ekle veya güncelle
        const insertQuery = `
            INSERT INTO friends (sender_id, receiver_id, status, created_at)
            VALUES ($1, $2, 'pending', NOW())
            ON CONFLICT (sender_id, receiver_id)
            DO UPDATE SET status = 'pending', created_at = NOW()
            RETURNING *
        `;
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
        if (!authHeader) return res.status(401).json({ message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // Receiver’ın ayarını çek
        const settingsQuery = `SELECT block_opposite_gender_follow FROM user_settings WHERE user_id = $1`;
        const settingsResult = await db.query(settingsQuery, [userId]);
        const blockOpposite = settingsResult.rows[0]?.block_opposite_gender_follow ?? false;

        const query = `
            SELECT 
                f.id AS request_id, 
                f.sender_id, 
                c.kullanici_adi AS sender_name, 
                c.gender AS sender_gender,  
                f.status, 
                f.created_at
            FROM friends f
            JOIN clients c ON f.sender_id = c.id
            WHERE f.receiver_id = $1 
              AND f.status = 'pending'
              AND NOT EXISTS (
                  SELECT 1 FROM blocked_users bu 
                  WHERE (bu.blocker_id = $1 AND bu.blocked_id = f.sender_id)
                     OR (bu.blocker_id = f.sender_id AND bu.blocked_id = $1)
              )
            ORDER BY f.created_at DESC
        `;

        let result = await db.query(query, [userId]);

        // Karşı cins filtrelemesi (block açıksa)
        if (blockOpposite) {
            const myGenderQuery = `SELECT gender FROM clients WHERE id = $1`;
            const myGenderResult = await db.query(myGenderQuery, [userId]);
            const myGender = myGenderResult.rows[0]?.gender?.toLowerCase();

            result.rows = result.rows.filter(r => r.sender_gender?.toLowerCase() === myGender);
        }

        return res.status(200).json({ success: true, data: result.rows });

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
/*
export const DeleteClient = async (req, res) => {
    try {
        const { answer, userCode, deviceId } = req.body; 

        const userResult = await db.query("SELECT security_answer, device_id FROM users WHERE id = $1", [userId]);
        const user = userResult.rows[0];

    
        if (user.device_id !== userCode) {
            return res.status(403).json({ message: "Girdiğiniz güvenlik kodu hatalı!" });
        }

     
        if (user.device_id !== deviceId) {
            return res.status(403).json({ 
                message: "Güvenlik İhlali! Bu işlem sadece hesabın kayıtlı olduğu telefondan yapılabilir." 
            });
        }

      
        if (user.security_answer !== answer) {
            return res.status(403).json({ message: "Güvenlik sorusu cevabı yanlış!" });
        }

     
        await db.query("DELETE FROM users WHERE id = $1", [userId]);
        return res.status(200).json({ success: true, message: "Hesap başarıyla silindi." });

    } catch (error) {
        return res.status(500).json({ message: "Sunucu hatası" });
    }
};
*/
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

    const token = authHeader.split(" ")[1]; 
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


export const BlockUser = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) {
            console.warn("BlockUser: Authorization header yok");
            return res.status(401).json({ success: false, message: "Token yok" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const blocker_id = decoded.id;

        const { userId: blocked_id } = req.body;

        console.log("BlockUser request =>", {
            blocker_id,
            blocked_id,
            body: req.body
        });

        if (blocker_id === blocked_id) {
            console.warn(`Kendi kendini engelleme denemesi: ${blocker_id}`);
            return res.status(400).json({ success: false, message: "Kendini engelleyemezsin." });
        }

       
        const checkQuery = `
            SELECT * FROM blocked_users
            WHERE blocker_id = $1 AND blocked_id = $2
        `;
        console.log("Check query params:", [blocker_id, blocked_id]);
        const existing = await db.query(checkQuery, [blocker_id, blocked_id]);

        if (existing.rows.length > 0) {
            console.warn(`Kullanıcı zaten engellenmiş: blocker=${blocker_id}, blocked=${blocked_id}`);
            return res.status(400).json({ success: false, message: "Bu kullanıcıyı zaten engellemişsin." });
        }

     
        const insertQuery = `
            INSERT INTO blocked_users (blocker_id, blocked_id)
            VALUES ($1, $2)
            RETURNING *
        `;
        console.log("Insert query params:", [blocker_id, blocked_id]);
        const result = await db.query(insertQuery, [blocker_id, blocked_id]);

        console.log("BlockUser success =>", result.rows[0]);

        return res.status(200).json({
            success: true,
            message: "Kullanıcı engellendi.",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("BlockUser error:", {
            message: error.message,
            stack: error.stack
        });
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};



export const UnblockUser = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) {
            return res.status(401).json({ message: "Token yok" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const blocker_id = decoded.id;

        const { userId: blocked_id } = req.body;

        const deleteQuery = `
            DELETE FROM blocked_users
            WHERE blocker_id = $1 AND blocked_id = $2
            RETURNING *
        `;
        const result = await db.query(deleteQuery, [blocker_id, blocked_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Bu kullanıcıyı engellememişsin." });
        }

        return res.status(200).json({
            message: "Kullanıcının engeli kaldırıldı.",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("UnblockUser error:", error);
        return res.status(500).json({ message: "Sunucu hatası", error: error.message });
    }
};


export const GetBlockedUsers = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) {
            return res.status(401).json({ success: false, message: "Token yok" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const blocker_id = decoded.id;

        const query = `
            SELECT c.id, c.kullanici_adi, c.gender, c.photo_base64, b.created_at
            FROM blocked_users b
            JOIN clients c ON c.id = b.blocked_id
            WHERE b.blocker_id = $1
        `;
        const result = await db.query(query, [blocker_id]);

        return res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("GetBlockedUsers error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};


export const DeleteClientAccount = async (req, res) => {
  try {
    const userId = parseInt(req.userId);
    const { answer } = req.body; 

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Geçersiz id" });
    }

    
    const checkResult = await db.query(
      "SELECT security_answer FROM clients WHERE id = $1",
      [userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const realAnswer = checkResult.rows[0].security_answer;

    
    if (realAnswer.toLowerCase() !== String(answer).toLowerCase()) {
      return res.status(401).json({ success: false, message: "Güvenlik cevabı yanlış!" });
    }

    
    await db.query("DELETE FROM clients WHERE id = $1", [userId]);

    return res.json({ success: true, message: "Hesap silindi" });
  } catch (err) {
    console.error("DeleteClient error:", err);
    return res.status(500).json({
      success: false,
      message: "Sunucu hatası",
      error: err.message,
    });
  }
};


export const PutClient = async (req, res) => {
  try {
   
    const { kullanici_adi, password, security_answer, deviceId } = req.body;
    const userId = req.userId; 

    if (!kullanici_adi || !password || !security_answer || !deviceId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi gönderildi!" });
    }

    
    const userResult = await db.query(
      "SELECT security_answer, device_id FROM clients WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    const dbUser = userResult.rows[0];

  
    if (dbUser.device_id !== deviceId) {
      return res.status(403).json({ 
        success: false, 
        message: "Güvenlik İhlali! Bilgiler sadece kayıtlı cihazdan güncellenebilir." 
      });
    }

   
    if (dbUser.security_answer.toLowerCase() !== security_answer.toLowerCase()) {
      return res.status(403).json({ success: false, message: "Güvenlik cevabı yanlış!" });
    }

  
    const checkUser = await db.query(
      "SELECT id FROM clients WHERE kullanici_adi = $1 AND id != $2",
      [kullanici_adi, userId]
    );
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu kullanıcı adı zaten başka birine ait" });
    }

  
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "UPDATE clients SET kullanici_adi = $1, password = $2 WHERE id = $3",
      [kullanici_adi, hashedPassword, userId]
    );

    return res.json({ success: true, message: "Hesap bilgileriniz başarıyla güncellendi ✅" });

  } catch (err) {
    console.error("PutClient Error:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası oluştu" });
  }
};


export const createComplaint = async (req, res) => {
    try {
        const userId = req.userId; 
        const { ilan_id, reason } = req.body;

        if (!ilan_id || !reason) {
            return res.status(400).json({
                success: false,
                message: "İlan ID ve şikayet nedeni zorunludur!"
            });
        }

       
        const ilanResult = await db.query(
            `
            SELECT i.client_id, c.kullanici_adi
            FROM ilanlar i
            JOIN clients c ON i.client_id = c.id
            WHERE i.id = $1
            `,
            [ilan_id]
        );

        if (ilanResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "İlan bulunamadı!"
            });
        }

        const { client_id, kullanici_adi } = ilanResult.rows[0];

      
        const complaintResult = await db.query(
            `
            INSERT INTO complaints (ilan_id, client_id, kullanici_adi, reason, reported_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [ilan_id, client_id, kullanici_adi, reason, userId]
        );

        return res.status(201).json({
            success: true,
            message: "Şikayet başarıyla kaydedildi!",
            data: complaintResult.rows[0]
        });

    } catch (error) {
        console.error("Şikayet oluşturma hatası:", error);
        return res.status(500).json({
            success: false,
            message: "Sunucu hatası"
        });
    }
};


export const SikayetetYorum = async (req, res) => {
    try {
        const { yorum_id, reason } = req.body;
        const sikayet_eden_id = req.userId; 

        if (!yorum_id || !reason) {
            return res.status(400).json({ success: false, message: "Yorum ID ve sebep gerekli." });
        }

        const query = `
            INSERT INTO yorum_sikayetleri (yorum_id, sikayet_eden_id, reason)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await db.query(query, [yorum_id, sikayet_eden_id, reason]);

        res.json({ success: true, message: "Yorum şikayet edildi.", data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
};


export const Deletefriends = async (req, res) => {
    const startTime = Date.now();
    try {
        const friendId = req.params.friendId; 
       
        const myId = req.user ? req.user.id : req.userId; 

        console.log("--------------------------------------------------");
        console.log(`[LOG] ARKADAŞ SİLME İSTEĞİ BAŞLATILDI`);
        console.log(`[LOG] İstek Yapan (Ben): ${myId}`);
        console.log(`[LOG] Silinecek Arkadaş: ${friendId}`);

        if (!myId || !friendId) {
            console.error("[ERROR] Eksik ID tespiti!");
            return res.status(400).json({ success: false, message: "Kullanıcı ID'leri eksik." });
        }

        const query = `
            DELETE FROM friends
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
        `;

        console.log(`[LOG] SQL Sorgusu Çalıştırılıyor...`);
        const result = await db.query(query, [myId, friendId]);

        const duration = Date.now() - startTime;

        if (result.rowCount > 0) {
            console.log(`[SUCCESS] Silme Başarılı! Silinen Satır Sayısı: ${result.rowCount}`);
            console.log("--------------------------------------------------");

            return res.status(200).json({ 
                success: true, 
                message: "Arkadaş başarıyla silindi.",
                debug_info: { deletedCount: result.rowCount, time: duration }
            });
        } else {
            console.warn(`[WARN] Kayıt bulunamadı. DB'de böyle bir arkadaşlık yok.`);
            console.log("--------------------------------------------------");

            return res.status(404).json({ 
                success: false, 
                message: "Silinecek arkadaşlık kaydı bulunamadı." 
            });
        }
    } catch (err) {
        console.error("##################################################");
        console.error(`[FATAL ERROR] Kod Patladı: ${err.message}`);
        console.error("##################################################");
        
        // Hata durumunda 'message' yerine 'err.message' kullanıyoruz
        res.status(500).json({ success: false, message: err.message });
    }
};

export const ResetPasswordWithDevice = async (req, res) => {
    const { client_name, device_id, new_password } = req.body;

    try {
        // 1. ADIM: Tablo adını 'clients' ve sütun adını 'kullanici_adi' yaptık (Fotoğrafa göre)
        const userQuery = await db.query("SELECT * FROM clients WHERE kullanici_adi = $1", [client_name]);
        
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Kullanıcı adı bulunamadı!" 
            });
        }

        const user = userQuery.rows[0];

        // 2. ADIM: Cihaz ID kontrolü (Veritabanındaki 'device_id' sütunuyla karşılaştırır)
        if (user.device_id !== device_id) {
            return res.status(403).json({ 
                success: false, 
                message: "Cihaz kimliği doğrulanamadı! Bu işlem sadece kayıtlı cihazdan yapılabilir." 
            });
        }

        // 3. ADIM: Güvenlik için şifreyi hash'liyoruz
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(new_password, saltRounds);

        // 4. ADIM: Şifreyi güncelle (Tablo adı: clients)
        // Fotoğrafta id sütunu görünüyor, o yüzden 'id' üzerinden güncelliyoruz
        await db.query("UPDATE clients SET password = $1 WHERE id = $2", [hashedPassword, user.id]);

        return res.status(200).json({ 
            success: true, 
            message: "Kimlik doğrulandı. Şifreniz başarıyla güncellendi." 
        });

    } catch (err) {
        console.error("Şifre Sıfırlama Hatası:", err);
        return res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası! Lütfen teknik ekiple iletişime geçin." 
        });
    }
};
