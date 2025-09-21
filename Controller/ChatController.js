import db from '../database/DB.js';


export const sendMessage = async (req, res) => {
    try {
        const sender_id = parseInt(req.userId); 
        if (isNaN(sender_id)) {
            return res.status(400).json({ error: "Geçersiz sender_id" });
        }

        const { receiver_id, message } = req.body;
        const recv_id = parseInt(receiver_id);

        if (!recv_id || !message) {
            return res.status(400).json({ error: "Eksik veya geçersiz veri" });
        }

    
        const friendCheck = await db.query(
            `SELECT * FROM friends 
             WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)) 
             AND status='accepted'`,
            [sender_id, recv_id]
        );

        if (friendCheck.rows.length === 0) {
            return res.status(403).json({ error: "Sadece arkadaşlara mesaj gönderebilirsin" });
        }

        const result = await db.query(
            `INSERT INTO messages (sender_id, receiver_id, message) 
             VALUES ($1, $2, $3) RETURNING *`,
            [sender_id, recv_id, message]
        );

        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Mesaj kaydedilirken hata:", err);
        return res.status(500).json({ error: "Mesaj gönderilemedi" });
    }
};


export const getMessages = async (req, res) => {
    try {
        const sender_id = parseInt(req.userId);
        if (isNaN(sender_id)) return res.status(400).json({ error: "Geçersiz sender_id" });

        const receiver_id = parseInt(req.query.receiver_id);
        if (!receiver_id) return res.status(400).json({ error: "Receiver_id gerekli veya geçersiz" });

        const result = await db.query(
            `SELECT * FROM messages 
             WHERE (sender_id=$1 AND receiver_id=$2) 
                OR (sender_id=$2 AND receiver_id=$1) 
             ORDER BY created_at ASC`,
            [sender_id, receiver_id]
        );

        return res.json(result.rows);
    } catch (err) {
        console.error("Mesajlar alınırken hata:", err);
        return res.status(500).json({ error: "Mesajlar alınamadı" });
    }
};

export const getConversations = async (req, res) => {
    try {
        const userId = parseInt(req.userId);
        if (isNaN(userId)) return res.status(400).json({ error: "Geçersiz userId" });

        const result = await db.query(`
            SELECT
                c.id AS user_id,
                c.kullanici_adi AS name,
                c.photo_base64 AS photo,
                m.message AS last_message,
                m.created_at AS last_message_time
            FROM clients c
            JOIN LATERAL (
                SELECT *
                FROM messages
                WHERE (sender_id = $1 AND receiver_id = c.id)
                   OR (sender_id = c.id AND receiver_id = $1)
                ORDER BY created_at DESC
                LIMIT 1
            ) m ON true
            WHERE c.id != $1
            ORDER BY m.created_at DESC;
        `, [userId]);

     
        const conversations = result.rows.filter(row => row.last_message !== null);

        return res.json(conversations);
    } catch (err) {
        console.error("Konuşmalar alınamadı:", err);
        return res.status(500).json({ error: "Konuşmalar alınamadı" });
    }
};