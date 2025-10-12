import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { turkishWords } from './data/turkishWords';
import * as dotenv from 'dotenv';
import { sendToTelegram } from './utils/telegramLogger';

dotenv.config();

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

// ------------------- Bulmaca Oluşturma Fonksiyonu (GÜNCELLENDİ) -------------------
const allWordsSet = new Set(
    Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3)
);

function createPuzzle(difficulty: number): { letters: string[], words: string[] } | null {
    const MIN_WORD_COUNT = 5;
    const MAX_WORD_COUNT = 8;
    const MAX_ATTEMPTS = 5000;
    const MIN_ATTEMPTS = 70; // YENİ: Minimum deneme sayısı eklendi.

    const wordsByLength = Array.from(allWordsSet).filter(w => w.length === difficulty);

    if (wordsByLength.length === 0) {
      console.error(`Bu uzunlukta (${difficulty}) hiç kelime bulunamadı.`);
      return null;
    }

    let lastFoundPuzzle: { letters: string[], words: string[] } | null = null; // YENİ: Bulunan son geçerli bulmacayı saklamak için

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const baseWord = wordsByLength[Math.floor(Math.random() * wordsByLength.length)];
      const letters = [...baseWord];
      const constructibleSet = generateWordsFromLetters(letters, allWordsSet, difficulty);

      const wordsArray = Array.from(constructibleSet);

      // İç içe kelime kontrolü
      const filteredWords = wordsArray.filter(word => {
        return !wordsArray.some(otherWord =>
          otherWord !== word && otherWord.includes(word)
        );
      });

      // Filtrelenmiş kelime sayısı kontrolü
      if (filteredWords.length < MIN_WORD_COUNT || filteredWords.length > MAX_WORD_COUNT) {
        continue;
      }

      // 3 harfli kelime kontrolü
      const threeLetterWordCount = filteredWords.filter(w => w.length === 3).length;
      if (threeLetterWordCount > 2) {
        continue;
      }

      // YENİ: Geçerli bir bulmaca bulunduğunda...
      const finalWords = filteredWords.sort((a, b) => a.length - b.length || a.localeCompare(b));
      lastFoundPuzzle = { letters, words: finalWords }; // Bu bulmacayı kaydet

      // ... ve eğer minimum deneme sayısını geçtiysek, daha fazla arama yapmadan bu bulmacayı döndür.
      if (attempt >= MIN_ATTEMPTS) {
        console.log(`✅ Bulmaca bulundu (attempt ${attempt + 1}, min deneme sayısını geçti)`);
        sendToTelegram(`✅ Bulmaca bulundu (attempt ${attempt + 1}, min deneme sayısını geçti)`);
        console.log(`Harfler: ${letters.join(', ')}`);
        sendToTelegram(`Harfler: ${letters.join(', ')}`);
        console.log(`Kelimeler (${lastFoundPuzzle.words.length}): ${lastFoundPuzzle.words.join(', ')}`);
        sendToTelegram(`Kelimeler (${lastFoundPuzzle.words.length}): ${lastFoundPuzzle.words.join(', ')}`);
        console.log('-----------------------------');
        return lastFoundPuzzle;
      }
    }

    // YENİ: Döngü bittiğinde, eğer minimum deneme sayısına ulaşmadan önce bir bulmaca bulunduysa onu döndür.
    if (lastFoundPuzzle) {
        console.log(`✅ Bulmaca bulundu (döngü sonunda bulunan son geçerli bulmaca kullanıldı)`);
        sendToTelegram(`✅ Bulmaca bulundu (döngü sonunda bulunan son geçerli bulmaca kullanıldı)`);
        console.log(`Harfler: ${lastFoundPuzzle.letters.join(', ')}`);
        sendToTelegram
        console.log(`Kelimeler (${lastFoundPuzzle.words.length}): ${lastFoundPuzzle.words.join(', ')}`);
        sendToTelegram(`Kelimeler (${lastFoundPuzzle.words.length}): ${lastFoundPuzzle.words.join(', ')}`);
        console.log('-----------------------------');
        return lastFoundPuzzle;
    }


    console.error(`❌ Hiç uygun bulmaca bulunamadı (${MIN_WORD_COUNT}-${MAX_WORD_COUNT} kelime ve en fazla 2 adet 3 harfli kelime).`);
    return null;
}

// ------------------- Socket.IO Mantığı -------------------
interface Player {
  name: string;
  score: number;
  socketId: string;
  isConnected: boolean;
}

interface GameRoom {
  puzzle: { letters: string[], words: string[] };
  players: { [playerName: string]: Player }; // İsim bazlı
  foundWords: { [word: string]: string }; // word -> playerName
  difficulty: number;
}

const gameRooms: { [roomId: string]: GameRoom } = {};
const emptyRoomTimers = new Map<string, NodeJS.Timeout>();
const disconnectedPlayerTimers = new Map<string, NodeJS.Timeout>();
// Socket ID -> RoomID ve PlayerName eşlemesi
const socketToPlayer = new Map<string, { roomId: string, playerName: string }>();

io.on('connection', (socket) => {
  console.log(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);
  sendToTelegram(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);

  // Oda oluşturma

  socket.on('createRoom', ({ difficulty, roomName, playerName }) => {
    if (emptyRoomTimers.has(roomName)) {
        clearTimeout(emptyRoomTimers.get(roomName)!);
        emptyRoomTimers.delete(roomName);
        console.log(`⏰ ${roomName} odası için kapatma sayacı iptal edildi.`);
        sendToTelegram(`⏰ ${roomName} odası için kapatma sayacı iptal edildi.`);
    }
      
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
      players: {
        [playerName]: { name: playerName, score: 0, socketId: socket.id, isConnected: true }
      },
      foundWords: {},
      difficulty: difficulty
    };

    socketToPlayer.set(socket.id, { roomId: roomName, playerName });
    socket.join(roomName);
    
    console.log(`🚪 ${playerName} (${socket.id}) kullanıcısı "${roomName}" odasını oluşturdu.`);
    sendToTelegram(`🚪 ${playerName} (${socket.id}) kullanıcısı "${roomName}" odasını oluşturdu.`);
    socket.emit('roomCreated', { roomId: roomName, puzzle, players: gameRooms[roomName].players });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (emptyRoomTimers.has(roomId)) {
        clearTimeout(emptyRoomTimers.get(roomId)!);
        emptyRoomTimers.delete(roomId);
        console.log(`⏰ ${roomId} odası için kapatma sayacı iptal edildi.`);
        sendToTelegram(`⏰ ${roomId} odası için kapatma sayacı iptal edildi.`);
    }

    const room = gameRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Oda bulunamadı.' });
      return;
    }

    socket.join(roomId);
    socketToPlayer.set(socket.id, { roomId, playerName });

    // Eğer oyuncu zaten odadaysa (yeniden bağlanma)
    const playerTimerKey = `${roomId}-${playerName}`;
    if (room.players[playerName]) {
      // Disconnect zamanlayıcısını iptal et
      if (disconnectedPlayerTimers.has(playerTimerKey)) {
        clearTimeout(disconnectedPlayerTimers.get(playerTimerKey)!);
        disconnectedPlayerTimers.delete(playerTimerKey);
      }
      
      // Socket ID'yi güncelle ve bağlantıyı aktif yap
      room.players[playerName].socketId = socket.id;
      room.players[playerName].isConnected = true;
      console.log(`🔄 ${playerName} (${socket.id}) "${roomId}" odasına geri döndü (Puan: ${room.players[playerName].score}).`);
      sendToTelegram(`🔄 ${playerName} (${socket.id}) "${roomId}" odasına geri döndü (Puan: ${room.players[playerName].score}).`);
    } else {
      // Yeni oyuncu
      room.players[playerName] = { name: playerName, score: 0, socketId: socket.id, isConnected: true };
      console.log(`➡️ ${playerName} (${socket.id}) "${roomId}" odasına katıldı.`);
      sendToTelegram(`➡️ ${playerName} (${socket.id}) "${roomId}" odasına katıldı.`);
    }
    
    socket.emit('joinSuccess', { roomId });
    socket.emit('gameUpdate', {
        puzzle: room.puzzle,
        players: room.players,
        foundWords: room.foundWords
    });

    socket.to(roomId).emit('playerJoined', { players: room.players });
  });

  socket.on('wordFound', ({ roomId, word }) => {
    const room = gameRooms[roomId];
    const normalizedWord = normalize(word);
    
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo || !room || !room.puzzle.words.includes(normalizedWord) || room.foundWords[normalizedWord]) {
      return;
    }

    const playerName = playerInfo.playerName;
    room.players[playerName].score += normalizedWord.length;
    room.foundWords[normalizedWord] = playerName;

    const allWordsFound = Object.keys(room.foundWords).length === room.puzzle.words.length;

    if (allWordsFound) {
      console.log(`🎉 "${roomId}" odasındaki bulmaca tamamlandı! Yeni bulmaca oluşturuluyor...`);
      sendToTelegram(`🎉 "${roomId}" odasındaki bulmaca tamamlandı! Yeni bulmaca oluşturuluyor...`);
      const newPuzzle = createPuzzle(room.difficulty);

      if (newPuzzle) {
        room.puzzle = newPuzzle;
        room.foundWords = {};
        
        setTimeout(() => {
          io.to(roomId).emit('newRound', {
            puzzle: room.puzzle,
            players: room.players
          });
        }, 1500);
      } else {
        io.to(roomId).emit('error', { message: 'Yeni bulmaca oluşturulamadı. Oyun sona erdi.' });
      }
    } else {
      io.to(roomId).emit('gameUpdate', {
        players: room.players,
        foundWords: room.foundWords
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`👋 Kullanıcı ayrıldı: ${socket.id}`);
    sendToTelegram(`👋 Kullanıcı ayrıldı: ${socket.id}`);
    
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) return;

    const { roomId, playerName } = playerInfo;
    const room = gameRooms[roomId];
    
    if (!room || !room.players[playerName]) return;

    const player = room.players[playerName];
    player.isConnected = false;
    
    console.log(`⏳ ${playerName} "${roomId}" odasından geçici olarak ayrıldı (Puan: ${player.score}). 5 dakika bekleniyor...`);
    sendToTelegram(`⏳ ${playerName} "${roomId}" odasından geçici olarak ayrıldı (Puan: ${player.score}). 5 dakika bekleniyor...`);

    const playerTimerKey = `${roomId}-${playerName}`;
    const timer = setTimeout(() => {
      if (gameRooms[roomId] && gameRooms[roomId].players[playerName] && !gameRooms[roomId].players[playerName].isConnected) {
        delete gameRooms[roomId].players[playerName];
        console.log(`🗑️ ${playerName} 5 dakika içinde geri dönmediği için "${roomId}" odasından çıkarıldı.`);
        sendToTelegram(`🗑️ ${playerName} 5 dakika içinde geri dönmediği için "${roomId}" odasından çıkarıldı.`);
        
        io.to(roomId).emit('playerLeft', { players: gameRooms[roomId].players });
        
        // Oda boş kaldıysa
        if (Object.keys(gameRooms[roomId].players).length === 0) {
          console.log(`🚪 ${roomId} odası boş. Kapatmak için 5 dakika sayacı başlatıldı.`);
          sendToTelegram(`🚪 "${roomId}" odası boş. Kapatmak için 5 dakika sayacı başlatıldı.`);
          
          const roomTimer = setTimeout(() => {
            if (gameRooms[roomId] && Object.keys(gameRooms[roomId].players).length === 0) {
              delete gameRooms[roomId];
              console.log(`🗑️ ${roomId} odası 5 dakika boş kaldığı için kapatıldı.`);
              sendToTelegram(`🗑️ "${roomId}" odası 5 dakika boş kaldığı için kapatıldı.`);
            }
            emptyRoomTimers.delete(roomId);
          }, 300000); // 5 dakika
    
          emptyRoomTimers.set(roomId, roomTimer);
        }
      }
      disconnectedPlayerTimers.delete(playerTimerKey);
    }, 300000); // 5 dakika

    disconnectedPlayerTimers.set(playerTimerKey, timer);
    socketToPlayer.delete(socket.id);
  });
});

// ------------------- REST API -------------------
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
    } catch (err: any) {
      console.error('💥 Bulmaca oluşturulurken hata:', err);
      sendToTelegram(`API Error: /api/v1/puzzles/random - ${err.message}`);
      return res.status(500).json({ error: 'Bulmaca oluşturulurken bir hata oluştu.' });
    }
});

// ------------------- Sunucuyu Başlatma -------------------
httpServer.listen(port, HOST, () => {
  const startMessage = `✅ Backend ${HOST}:${port} adresinde çalışıyor.`;
  console.log(startMessage);
  sendToTelegram(startMessage);
});

// ------------------- Genel Hata Yakalama -------------------
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  sendToTelegram(`*CRITICAL: Uncaught Exception*\n\`\`\`\n${errorMessage}\n\`\`\``).finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥', reason);
  const reasonMessage = reason instanceof Error ? reason.message : String(reason);
  sendToTelegram(`*CRITICAL: Unhandled Rejection*\n\`\`\`\n${reasonMessage}\n\`\`\``);
});
