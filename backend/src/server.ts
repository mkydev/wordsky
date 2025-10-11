import express from 'express';
import cors from 'cors';
import { turkishWords } from './data/turkishWords';

const app = express();
app.use(cors());
const port = 3000;
const HOST = '0.0.0.0';

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
function generateWordsFromLetters(
  letters: string[],
  allWords: Set<string>, // 💡 Set olarak al
  maxWordLength: number
): Set<string> { // 💡 Set olarak döndür
  const foundWords = new Set<string>();
  for (const word of allWords) {
    if (word.length >= 3 && word.length <= maxWordLength && canFormWord(word, letters)) {
      foundWords.add(word);
    }
  }
  return foundWords;
}

app.get('/api/v1/puzzles/random', (req, res) => {
  try {
    const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string, 10) : 4;

    if (![4, 5, 6, 7].includes(difficulty)) { // 7 harfli kelimeler eklendi
      return res.status(400).json({ error: 'Geçersiz zorluk seviyesi.' });
    }

    const MIN_WORD_COUNT = 5; // Sınırlar güncellendi
    const MAX_WORD_COUNT = 10;
    const MAX_ATTEMPTS = 500; // Deneme sayısı azaltıldı

    const allWords = new Set(
      Object.values(turkishWords)
        .flat()
        .map(normalize)
        .filter(w => w.length >= 3)
    );

    const wordsByLength = Array.from(allWords).filter(w => w.length === difficulty);

    if (wordsByLength.length === 0) {
      return res.status(500).json({ error: `Bu uzunlukta (${difficulty}) hiç kelime bulunamadı.` });
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // 1. Rastgele bir ana kelime seç
      const baseWord = wordsByLength[Math.floor(Math.random() * wordsByLength.length)];
      const letters = [...baseWord]; // Ana kelimenin harflerini kullan

      // 2. Bu harflerle oluşturulabilecek kelimeleri bul
      const constructibleSet = generateWordsFromLetters(letters, allWords, difficulty);

      // 3. Kelime sayısı uygunsa, bulmacayı döndür
      if (constructibleSet.size >= MIN_WORD_COUNT && constructibleSet.size <= MAX_WORD_COUNT) {
        const finalWords = Array.from(constructibleSet);

        console.log(`✅ Bulmaca bulundu (attempt ${attempt + 1})`);
        console.log(`Harfler: ${letters.join(', ')}`);
        console.log(`Kelimeler (${finalWords.length}): ${finalWords.join(', ')}`);
        console.log('-----------------------------');

        return res.json({
          letters,
          words: finalWords.sort((a, b) => a.length - b.length || a.localeCompare(b)),
        });
      }
    }

    console.error(`❌ Hiç uygun bulmaca bulunamadı (${MIN_WORD_COUNT}-${MAX_WORD_COUNT} kelime).`);
    return res.status(500).json({ error: 'Uygun bir bulmaca oluşturulamadı. Lütfen tekrar deneyin.' });

  } catch (err) {
    console.error('💥 Bulmaca oluşturulurken hata:', err);
    return res.status(500).json({ error: 'Bulmaca oluşturulurken bir hata oluştu.' });
  }
});

app.listen(port, HOST, () => {
  console.log(`✅ Backend ${HOST}:${port} adresinde alışıyor.`);
});