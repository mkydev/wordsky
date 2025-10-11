import { Router } from 'express';
import { generateWords } from '../utils/wordGenerator';
import fs from 'fs';
import path from 'path';

const router = Router();

// Tüm kelimeleri "words.txt" dosyasından oku ve normalize et
const uniqueWords = new Set(
  fs.readFileSync(path.join(__dirname, '../../../words.txt'), 'utf-8')
    .split('\n')
    .map(word => word.trim().toLocaleUpperCase('tr-TR'))
    .filter(word => word.length > 2)
);
const allWords = Array.from(uniqueWords);


router.get('/random', (req, res) => {
    const difficulty = parseInt(req.query.difficulty as string, 10);

    if (isNaN(difficulty) || difficulty < 4 || difficulty > 6) {
        return res.status(400).json({ message: 'Geçersiz zorluk seviyesi. 4, 5 veya 6 olmalı.' });
    }

    const possibleMainWords = allWords.filter(word => word.length === difficulty);

    if (possibleMainWords.length === 0) {
        return res.status(404).json({ message: 'Bu zorlukta hiç kelime bulunamadı.' });
    }

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        const randomIndex = Math.floor(Math.random() * possibleMainWords.length);
        const mainWord = possibleMainWords[randomIndex];

        if (!mainWord) {
            attempts++;
            continue;
        }

        const subWords = generateWords(mainWord, allWords);

        if (subWords.length >= 3) { // En az 3 alt kelime olmalı
            return res.json({
                letters: mainWord.split(''),
                words: subWords,
            });
        }

        attempts++;
    }

    return res.status(404).json({ message: 'Yeterli alt kelimeye sahip bir bulmaca oluşturulamadı, tekrar deneyin.' });
});

export default router;