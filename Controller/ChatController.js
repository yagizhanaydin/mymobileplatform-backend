import db from '../database/DB.js';

// Yardımcı fonksiyon: Saat ve dakika al
const formatTime = (date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

// Mesaj gönderme
export const sendMessage = async (req, res) => {
    try {
        const senderId = parseInt(req.userId);
        console.log("sendMessage: senderId=", senderId);

        if (isNaN(senderId)) return res.status(400).json({ error: "Geçersiz sender_id" });

        const { receiver_id, message } = req.body;
        const recvId = parseInt(receiver_id);
        console.log("sendMessage: receiverId=", recvId, "message=", message);

        if (isNaN(recvId) || !message) return res.status(400).json({ error: "Eksik veya geçersiz veri" });

        // Arkadaş kontrolü
        const friendCheck = await db.query(
            `SELECT * FROM friends 
             WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)) 
             AND status='accepted'`,
            [senderId, recvId]
        );
        console.log("sendMessage: friendCheck.rows.length=", friendCheck.rows.length);

        if (friendCheck.rows.length === 0) {
            return res.status(403).json({ error: "Sadece arkadaşlara mesaj gönderebilirsin" });
        }

        // Mesaj ekleme
        const result = await db.query(
            `INSERT INTO messages (sender_id, receiver_id, message, deleted_by_sender, deleted_by_receiver) 
             VALUES ($1, $2, $3, FALSE, FALSE) 
             RETURNING *`,
            [senderId, recvId, message]
        );
        console.log("sendMessage: message inserted:", result.rows[0]);

        const messageWithTime = {
            ...result.rows[0],
            created_at: formatTime(result.rows[0].created_at)
        };

        return res.status(201).json(messageWithTime);

    } catch (err) {
        console.error("sendMessage error:", err);
        return res.status(500).json({ error: "Mesaj gönderilemedi" });
    }
};

// Kullanıcılar arasındaki mesajları al
export const getMessages = async (req, res) => {
    try {
        const userId = parseInt(req.userId);
        const otherUserId = parseInt(req.params.id || req.query.receiver_id);
        console.log("getMessages: userId=", userId, "otherUserId=", otherUserId);

        if (isNaN(userId) || isNaN(otherUserId)) {
            return res.status(400).json({ error: "Geçersiz userId veya otherUserId" });
        }

        const result = await db.query(`
            SELECT *
            FROM messages
            WHERE 
                (sender_id = $1 AND receiver_id = $2 AND deleted_by_sender = FALSE)
                OR
                (sender_id = $2 AND receiver_id = $1 AND deleted_by_receiver = FALSE)
            ORDER BY created_at ASC
        `, [userId, otherUserId]);
        console.log("getMessages: messages fetched=", result.rows.length);

        const formatted = result.rows.map(msg => ({
            ...msg,
            created_at: formatTime(msg.created_at)
        }));

        return res.json(formatted);
    } catch (err) {
        console.error("getMessages error:", err);
        return res.status(500).json({ error: "Mesajlar alınamadı" });
    }
};

// Tüm konuşmaları al (son mesajlarla)
export const getConversations = async (req, res) => {
    try {
        const userId = parseInt(req.userId);
        console.log("getConversations: userId=", userId);
        if (isNaN(userId)) return res.status(400).json({ error: "Geçersiz userId" });

        const result = await db.query(`
            SELECT
                c.id AS user_id,
                c.kullanici_adi AS name,
                c.photo_base64 AS photo,
                m.id AS last_message_id,
                m.message AS last_message,
                m.created_at AS last_message_created_at
            FROM clients c
            LEFT JOIN LATERAL (
                SELECT *
                FROM messages
                WHERE ((sender_id = $1 AND receiver_id = c.id AND deleted_by_sender = FALSE)
                   OR (sender_id = c.id AND receiver_id = $1 AND deleted_by_receiver = FALSE))
                ORDER BY created_at DESC
                LIMIT 1
            ) m ON true
            WHERE c.id != $1 AND m.id IS NOT NULL
            ORDER BY m.created_at DESC;
        `, [userId]);
        console.log("getConversations: conversations fetched=", result.rows.length);

        const formatted = result.rows.map(conv => ({
            ...conv,
            last_message_time: formatTime(conv.last_message_created_at)
        }));

        return res.json(formatted);

    } catch (err) {
        console.error("getConversations error:", err);
        return res.status(500).json({ error: "Konuşmalar alınamadı" });
    }
};

// Konuşmayı kendi tarafında sil
export const deleteConversation = async (req, res) => {
    try {
        const userId = parseInt(req.userId);
        const otherUserId = parseInt(req.params.id);
        console.log("deleteConversation: userId=", userId, "otherUserId=", otherUserId);

        if (isNaN(userId) || isNaN(otherUserId)) {
            return res.status(400).json({ error: "Geçersiz userId veya otherUserId" });
        }

        const result = await db.query(`
            UPDATE messages
            SET deleted_by_sender = CASE WHEN sender_id = $1 THEN TRUE ELSE deleted_by_sender END,
                deleted_by_receiver = CASE WHEN receiver_id = $1 THEN TRUE ELSE deleted_by_receiver END
            WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
            RETURNING *
        `, [userId, otherUserId]);
        console.log("deleteConversation: updated rows=", result.rows.length);

        return res.status(200).json({ message: "Tüm mesajlar sadece senin tarafında silindi", updated: result.rows.length });

    } catch (err) {
        console.error("deleteConversation error:", err);
        return res.status(500).json({ error: "Mesajlar silinirken hata oluştu" });
    }
};
