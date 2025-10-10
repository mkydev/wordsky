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
    // ... (dosyanın geri kalanı aynı)
});

export default router;