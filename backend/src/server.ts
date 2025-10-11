import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { turkishWords } from './data/turkishWords';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = 3000;
const HOST = '0.0.0.0';

// ------------------- Helper Fonksiyonları (Değişiklik yok) -------------------
function normalize(word: string) {
  return word
    .trim()
    .toLocaleUpperCase('tr')
    .replace(/[^A-ZÇĞİÖŞÜ]/gu, '');
}

function canFormWord(word: string, letters: string[]): boolean {
  const tempLetters = [...letters];
  for (const ch of word) {
    const index = tempLetters.indexOf(ch);
    if (index === -1) return false;
    tempLetters.splice(index, 1);
  }
  return true;
}

function generateWordsFromLetters(
  letters: string[],
  allWords: Set<string>,
  maxWordLength: number
): Set<string> {
  const foundWords = new Set<string>();
  for (const word of allWords) {
    if (word.length >= 3 && word.length <= maxWordLength && canFormWord(word, letters)) {
      foundWords.add(word);
    }
  }
  return foundWords;
}

// ------------------- Düzeltilmiş Bulmaca Oluşturma Fonksiyonu -------------------
const allWordsSet = new Set(
    Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3)
);

function createPuzzle(difficulty: number): { letters: string[], words: string[] } | null {
    const MIN_WORD_COUNT = 4;
    const MAX_WORD_COUNT = 8;
    const MAX_ATTEMPTS = 500;

    const wordsByLength = Array.from(allWordsSet).filter(w => w.length === difficulty);

    if (wordsByLength.length === 0) {
      console.error(`Bu uzunlukta (${difficulty}) hiç kelime bulunamadı.`);
      return null;
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const baseWord = wordsByLength[Math.floor(Math.random() * wordsByLength.length)];
      const letters = [...baseWord];
      const constructibleSet = generateWordsFromLetters(letters, allWordsSet, difficulty);

      if (constructibleSet.size >= MIN_WORD_COUNT && constructibleSet.size <= MAX_WORD_COUNT) {
        const finalWords = Array.from(constructibleSet).sort((a, b) => a.length - b.length || a.localeCompare(b));
        console.log(`✅ Multiplayer için bulmaca bulundu (attempt ${attempt + 1})`);
        console.log(`Harfler: ${letters.join(', ')}`);
        console.log(`Kelimeler (${finalWords.length}): ${finalWords.join(', ')}`);
        console.log('-----------------------------');

        return { letters, words: finalWords };
      }
    }

    console.error(`❌ Hiç uygun bulmaca bulunamadı (${MIN_WORD_COUNT}-${MAX_WORD_COUNT} kelime).`);
    return null; // Başarılı bir bulmaca bulunamazsa null döndür
}


// ------------------- Socket.IO Mantığı -------------------
const gameRooms: { [key: string]: any } = {};

io.on('connection', (socket) => {
  console.log(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);

  socket.on('createRoom', ({ difficulty }) => {
    const puzzle = createPuzzle(difficulty);

    if (!puzzle) { // Eğer bulmaca oluşturulamazsa, istemciye hata gönder
      socket.emit('error', { message: 'Uygun bir bulmaca oluşturulamadı, lütfen tekrar deneyin.' });
      return;
    }

    const roomId = `room-${Math.random().toString(36).substr(2, 5)}`;
    gameRooms[roomId] = {
      puzzle,
      players: { [socket.id]: { score: 0 } },
      foundWords: {}
    };

    socket.join(roomId);
    console.log(`🚪 ${socket.id} kullanıcısı ${roomId} odasını oluşturdu.`);
    socket.emit('roomCreated', { roomId, puzzle, players: gameRooms[roomId].players });
  });

  socket.on('joinRoom', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (room) {
      socket.join(roomId);
      room.players[socket.id] = { score: 0 };
      console.log(`➡️ ${socket.id} kullanıcısı ${roomId} odasına katıldı.`);
      
      // Odaya katılan oyuncuya oda ID'sini onayla
      socket.emit('joinSuccess', { roomId });

      // Odaya yeni katılan oyuncuya mevcut oyun durumunu gönder
      socket.emit('gameUpdate', {
          puzzle: room.puzzle,
          players: room.players,
          foundWords: room.foundWords
      });

      // Odadaki diğer oyunculara yeni bir oyuncunun katıldığını haber ver
      socket.to(roomId).emit('playerJoined', { players: room.players });
    } else {
      socket.emit('error', { message: 'Oda bulunamadı.' });
    }
  });

  socket.on('wordFound', ({ roomId, word }) => {
    const room = gameRooms[roomId];
    if (room && room.puzzle.words.includes(word) && !room.foundWords[word]) {
        room.players[socket.id].score += word.length;
        room.foundWords[word] = socket.id;

        io.to(roomId).emit('gameUpdate', {
            players: room.players,
            foundWords: room.foundWords
        });
    }
  });

  socket.on('disconnect', () => {
    console.log(`👋 Kullanıcı ayrıldı: ${socket.id}`);
    for (const roomId in gameRooms) {
      if (gameRooms[roomId].players[socket.id]) {
        delete gameRooms[roomId].players[socket.id];
        io.to(roomId).emit('playerLeft', { players: gameRooms[roomId].players });
        if (Object.keys(gameRooms[roomId].players).length === 0) {
          delete gameRooms[roomId];
          console.log(`🗑️ ${roomId} odası boş olduğu için kapatıldı.`);
        }
        break; 
      }
    }
  });
});

// Tek oyunculu mod için REST endpoint'i (değişiklik yok)
app.get('/api/v1/puzzles/random', (req, res) => {
    try {
      const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string, 10) : 4;
      if (![4, 5, 6, 7].includes(difficulty)) {
        return res.status(400).json({ error: 'Geçersiz zorluk seviyesi.' });
      }
      const puzzle = createPuzzle(difficulty);
      if (puzzle) {
        return res.json(puzzle);
      }
      return res.status(500).json({ error: 'Uygun bir bulmaca oluşturulamadı. Lütfen tekrar deneyin.' });
    } catch (err) {
      console.error('💥 Bulmaca oluşturulurken hata:', err);
      return res.status(500).json({ error: 'Bulmaca oluşturulurken bir hata oluştu.' });
    }
});


httpServer.listen(port, HOST, () => {
  console.log(`✅ Backend ${HOST}:${port} adresinde çalışıyor.`);
});