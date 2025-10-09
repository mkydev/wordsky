import express from 'express';
import cors from 'cors';
import { turkishWords } from './data/turkishWords';

const app = express();
app.use(cors());
const port = 3000;

app.get('/api/v1/puzzles/random', (req, res) => {
    const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string, 10) : 4;

    if (![4, 5, 6].includes(difficulty)) {
        return res.status(400).json({ error: 'Geçersiz zorluk seviyesi.' });
    }

    const wordsForDifficulty = turkishWords[difficulty as 4 | 5 | 6];

    if (!wordsForDifficulty || wordsForDifficulty.length < 3) {
        return res.status(404).json({ error: 'Bu zorluk seviyesi için yeterli kelime bulunamadı.' });
    }

    // Maksimum 500 deneme ile iyi bir bulmaca bulmaya çalış
    for (let attempt = 0; attempt < 500; attempt++) {
        // 1. Rastgele bir kelime seç.
        const randomIndex = Math.floor(Math.random() * wordsForDifficulty.length);
        const baseWord = wordsForDifficulty[randomIndex];
        
        // 2. Bu kelimenin benzersiz harflerini al.
        const puzzleLettersSet = new Set(baseWord.split(''));

        // 3. Harf sayısı, seçilen zorlukla tam olarak eşleşmiyorsa, bu denemeyi atla.
        if (puzzleLettersSet.size !== difficulty) {
            continue;
        }

        const puzzleLetters = Array.from(puzzleLettersSet);

        // 4. Bu harflerle oluşturulabilen tüm kelimeleri bul.
        const constructibleWords = wordsForDifficulty.filter(word => {
            // Bir kelimenin her harfinin, oluşturulan harf setinde olup olmadığını kontrol et.
            return [...word].every(letter => puzzleLettersSet.has(letter));
        });

        // 5. En az 3 anlamlı kelime bulunuyorsa, bu harika bir bulmacadır.
        if (constructibleWords.length >= 3) {
            // Bulmacayı ve harfleri gönder.
            return res.json({
                words: constructibleWords,
                letters: puzzleLetters,
            });
        }
    }

    // Yeterli denemeye rağmen uygun bir bulmaca bulunamazsa hata döndür.
    return res.status(500).json({ error: 'Uygun bir bulmaca oluşturulamadı. Lütfen tekrar deneyin.' });
});

app.listen(port, () => {
  console.log(`Backend sunucusu http://localhost:${port} adresinde çalışıyor.`);
});