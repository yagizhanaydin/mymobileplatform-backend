import db from '../database/DB.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Kullanıcı ayarlarını çek
export const GetUserSettings = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) return res.status(401).json({ success: false, message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // Ayar satırı yoksa ekle ve çek
        const query = `
            INSERT INTO user_settings (user_id, block_opposite_gender_follow)
            VALUES ($1, false)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING block_opposite_gender_follow
        `;
        const insertResult = await db.query(query, [userId]);

        if (insertResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                blockOppositeGenderFollow: insertResult.rows[0].block_opposite_gender_follow
            });
        }

        const selectQuery = `SELECT block_opposite_gender_follow FROM user_settings WHERE user_id = $1`;
        const selectResult = await db.query(selectQuery, [userId]);

        return res.status(200).json({
            success: true,
            blockOppositeGenderFollow: selectResult.rows[0].block_opposite_gender_follow
        });

    } catch (error) {
        console.error("GetUserSettings error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};

// Kullanıcı ayarlarını güncelle
export const UpdateUserSettings = async (req, res) => {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader) return res.status(401).json({ success: false, message: "Token yok" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { blockOppositeGenderFollow } = req.body;

        // Ayar satırı yoksa oluştur, varsa güncelle
        const upsertQuery = `
            INSERT INTO user_settings (user_id, block_opposite_gender_follow)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET block_opposite_gender_follow = $2, updated_at = NOW()
            RETURNING block_opposite_gender_follow
        `;
        const result = await db.query(upsertQuery, [userId, blockOppositeGenderFollow]);

        return res.status(200).json({
            success: true,
            message: "Ayar kaydedildi",
            blockOppositeGenderFollow: result.rows[0].block_opposite_gender_follow
        });

    } catch (error) {
        console.error("UpdateUserSettings error:", error);
        return res.status(500).json({ success: false, message: "Sunucu hatası", error: error.message });
    }
};
