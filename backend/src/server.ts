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

// ------------------- Helper Fonksiyonları -------------------
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

// ------------------- Bulmaca Oluşturma Fonksiyonu -------------------
const allWordsSet = new Set(
    Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3)
);

function createPuzzle(difficulty: number): { letters: string[], words: string[] } | null {
    const MIN_WORD_COUNT = 5;
    const MAX_WORD_COUNT = 10;
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
        
        console.log(`✅ Bulmaca bulundu (attempt ${attempt + 1})`);
        console.log(`Harfler: ${letters.join(', ')}`);
        console.log(`Kelimeler (${finalWords.length}): ${finalWords.join(', ')}`);
        console.log('-----------------------------');

        return { letters, words: finalWords };
      }
    }

    console.error(`❌ Hiç uygun bulmaca bulunamadı (${MIN_WORD_COUNT}-${MAX_WORD_COUNT} kelime).`);
    return null;
}


// ------------------- Socket.IO Mantığı -------------------
const gameRooms: { [key: string]: any } = {};

io.on('connection', (socket) => {
  console.log(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);

  socket.on('createRoom', ({ difficulty, roomName, playerName }) => {
    if (gameRooms[roomName]) {
      socket.emit('error', { message: `"${roomName}" isminde bir oda zaten mevcut.` });
      return;
    }

    const puzzle = createPuzzle(difficulty);
    if (!puzzle) {
      socket.emit('error', { message: 'Uygun bir bulmaca oluşturulamadı, lütfen tekrar deneyin.' });
      return;
    }

    gameRooms[roomName] = {
      puzzle,
      players: { [socket.id]: { name: playerName, score: 0 } },
      foundWords: {},
      difficulty: difficulty // Odanın zorluk seviyesini kaydet
    };

    socket.join(roomName);
    console.log(`🚪 ${playerName} (${socket.id}) kullanıcısı "${roomName}" odasını oluşturdu.`);
    socket.emit('roomCreated', { roomId: roomName, puzzle, players: gameRooms[roomName].players });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = gameRooms[roomId];
    if (room) {
      socket.join(roomId);
      room.players[socket.id] = { name: playerName, score: 0 };
      console.log(`➡️ ${playerName} (${socket.id}) kullanıcısı "${roomId}" odasına katıldı.`);
      
      socket.emit('joinSuccess', { roomId });

      socket.emit('gameUpdate', {
          puzzle: room.puzzle,
          players: room.players,
          foundWords: room.foundWords
      });

      socket.to(roomId).emit('playerJoined', { players: room.players });
    } else {
      socket.emit('error', { message: 'Oda bulunamadı.' });
    }
  });

  socket.on('wordFound', ({ roomId, word }) => {
    const room = gameRooms[roomId];
    if (!room || !room.puzzle.words.includes(word) || room.foundWords[word]) {
      return;
    }

    room.players[socket.id].score += word.length;
    room.foundWords[word] = socket.id;

    const allWordsFound = Object.keys(room.foundWords).length === room.puzzle.words.length;

    // Eğer tüm kelimeler bulunduysa, yeni turu başlat
    if (allWordsFound) {
      console.log(`🎉 "${roomId}" odasındaki bulmaca tamamlandı! Yeni bulmaca oluşturuluyor...`);
      const newPuzzle = createPuzzle(room.difficulty);

      if (newPuzzle) {
        room.puzzle = newPuzzle;
        room.foundWords = {};
        
        // Oyuncuların tebrik mesajını görmesi için kısa bir gecikme
        setTimeout(() => {
          io.to(roomId).emit('newRound', {
            puzzle: room.puzzle,
            players: room.players
          });
        }, 2500); // 2.5 saniye bekle
      } else {
        io.to(roomId).emit('error', { message: 'Yeni bulmaca oluşturulamadı. Oyun sona erdi.' });
      }
    } else {
      // Oyun devam ediyorsa normal güncelleme gönder
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
        const playerName = gameRooms[roomId].players[socket.id].name;
        delete gameRooms[roomId].players[socket.id];
        console.log(`(i) ${playerName} kullanıcısı "${roomId}" odasından ayrıldı.`);

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

// Tek oyunculu mod için REST endpoint'i
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