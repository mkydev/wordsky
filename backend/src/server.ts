import express from 'express';
import cors from 'cors';
import { turkishWords } from './data/turkishWords';

const app = express();
app.use(cors());
const port = 3000;

// 🔹 Harf normalize fonksiyonu
function normalize(word: string) {
  return word
    .trim()
    .toLocaleUpperCase('tr')
    .replace(/[^A-ZÇĞİÖŞÜ]/gu, '');
}

// 🔹 Rastgele harf seçimi (tekrar dahil)
function randomLettersFromPool(pool: string[], count: number): string[] {
  const letters: string[] = [];
  for (let i = 0; i < count; i++) {
    const randIndex = Math.floor(Math.random() * pool.length);
    letters.push(pool[randIndex]);
  }
  return letters;
}

// 🔹 Harf havuzundan kelime oluşturulabilir mi kontrolü
function canFormWord(word: string, letters: string[]): boolean {
  const tempLetters = [...letters];
  for (const ch of word) {
    const index = tempLetters.indexOf(ch);
    if (index === -1) return false;
    tempLetters.splice(index, 1);
  }
  return true;
}

// 🔹 Harflerden kelimeleri üret (3 → difficulty uzunluğunda)
function generateWordsFromLetters(letters: string[], allWords: string[], maxWordLength: number): string[] {
  return allWords.filter(word => {
    if (word.length < 3 || word.length > maxWordLength) return false;
    return canFormWord(word, letters);
  });
}

app.get('/api/v1/puzzles/random', (req, res) => {
  try {
    const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string, 10) : 4;

    if (![4, 5, 6].includes(difficulty)) {
      return res.status(400).json({ error: 'Geçersiz zorluk seviyesi.' });
    }

    // 🔹 Yeni: Kelime sınırları
    const MIN_WORD_COUNT = 6;
    const MAX_WORD_COUNT = 8;
    const MAX_ATTEMPTS = 1500;

    // 🔹 1. Tüm kelimeleri tek havuzda topla
    const allWords = Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3);

    // 🔹 2. Harf havuzu
    const letterPool = allWords.flatMap(w => [...w]);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // 🔹 3. Rastgele harfleri seç
      const letters = randomLettersFromPool(letterPool, difficulty);

      // 🔹 4. Bu harflerle oluşturulabilecek kelimeleri bul
      const constructible = generateWordsFromLetters(letters, allWords, difficulty);

      // 🔹 5. 6–8 kelime arasıysa döndür
      if (constructible.length >= MIN_WORD_COUNT && constructible.length <= MAX_WORD_COUNT) {
        console.log(`✅ Bulmaca bulundu (attempt ${attempt + 1})`);
        console.log(`Harfler: ${letters.join(', ')}`);
        console.log(`Kelimeler (${constructible.length}): ${constructible.join(', ')}`);
        console.log('-----------------------------');

        return res.json({
          letters,
          words: constructible
            .sort((a, b) => a.length - b.length)
            .slice(0, MAX_WORD_COUNT), // Fazlaysa 8 taneye indir
        });
      }
    }

    console.error('❌ Hiç uygun bulmaca bulunamadı (6–8 kelime).');
    return res.status(500).json({ error: 'Uygun bir bulmaca oluşturulamadı. Lütfen tekrar deneyin.' });
  } catch (err) {
    console.error('💥 Bulmaca oluşturulurken hata:', err);
    return res.status(500).json({ error: 'Bulmaca oluşturulurken bir hata oluştu.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend http://localhost:${port} adresinde çalışıyor.`);
});
