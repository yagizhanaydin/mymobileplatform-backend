import db from '../database/DB.js'
import bcrypt from 'bcrypt'
import path from 'path'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

export const DeleteYorum = async (req, res) => {
  console.log("--- SİLME İŞLEMİ BAŞLATILDI ---"); //
  try {
    const { yorumId } = req.params; //
    const myUserId = req.userId; // authenticateToken middleware'inden gelir

    console.log(`[LOG] Gelen Yorum ID: ${yorumId}`); //
    console.log(`[LOG] İşlemi Yapan Kullanıcı ID: ${myUserId}`); //

    if (!yorumId || !myUserId) {
      console.log("[HATA] Eksik veri: yorumId veya myUserId bulunamadı!"); //
      return res.status(400).json({ success: false, message: "Geçersiz istek parametreleri." }); //
    }

    // Veritabanı sorgusu
    const result = await db.query(
      "DELETE FROM yorumlar WHERE id = $1 AND client_id = $2 RETURNING *",
      [yorumId, myUserId]
    ); //

    if (result.rowCount === 0) {
      console.log(`[UYARI] Silme başarısız! ID: ${yorumId} olan yorum bu kullanıcıya (ID: ${myUserId}) ait değil veya zaten silinmiş.`); //
      return res.status(403).json({ success: false, message: "Bu yorumu silme yetkiniz yok!" }); //
    }

    console.log("[BAŞARI] Yorum veritabanından başarıyla temizlendi."); //
    return res.status(200).json({ success: true, message: "Yorum silindi." }); //

  } catch (error) {
    console.error("--- [KRİTİK HATA] ---"); //
    console.error(error.message); //
    return res.status(500).json({ success: false, message: "Sunucu tarafında teknik bir hata oluştu." }); //
  }
};