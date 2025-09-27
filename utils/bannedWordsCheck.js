import fs from "fs"
import path from "path"

// 🔹 Yasaklı kelime dosyası
const bannedWordsPath = path.resolve("./banned_words.json")
const banned_words = JSON.parse(fs.readFileSync(bannedWordsPath, "utf-8")).banned_words || []

// 🔹 Temel normalize: küçük harf, aksanları kaldır
export function baseNormalize(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // aksanları sil
}

// 🔹 Sadece harf ve rakamları al
function lettersAndDigits(str = "") {
  return Array.from(baseNormalize(str))
    .filter(ch => /\p{L}|\d/iu.test(ch))
    .join("")
}

// 🔹 Regex özel karakterlerini kaçış için
function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// 🔹 Banned kelimelerden regex listesi oluştur
const bannedRegexList = banned_words
  .map(word => lettersAndDigits(word))
  .filter(w => w.length > 0)
  .map(word => {
    const chars = Array.from(word)
      .map(ch => escapeForRegex(ch))
      .join("[^\\p{L}\\d]*") // araya karakter gelmişse yakala
    return new RegExp(chars, "iu")
  })

// 🔹 Yasak kelime kontrol fonksiyonu
export function containsBannedWord(input = "") {
  const base = baseNormalize(input)
  const inputLettersDigits = lettersAndDigits(base)

  // 1) Direkt includes ile kontrol (kısa kelimeleri de yakalar)
  for (const banned of banned_words) {
    const bLettersDigits = lettersAndDigits(banned)
    if (!bLettersDigits) continue
    if (inputLettersDigits.includes(bLettersDigits)) return true
  }

  // 2) Regex ile araya karakter/sayı eklenmiş varyasyonları yakala
  for (const rx of bannedRegexList) {
    if (rx.test(base)) return true
  }

  return false
}

// 🔹 Test
if (import.meta.main) {
  const testCases = [
    "kadınsiken123",   // yasak
    "ka.din.si-ken",   // yasak
    "porno",           // yasak
    "p0rn0",           // yasak
    "anasik",          // yasak
    "anasiken",        // yasak
    "temiznick"        // serbest
  ]

  for (const nick of testCases) {
    console.log(nick, "->", containsBannedWord(nick))
  }
}
