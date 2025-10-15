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

// ------------------- Yardımcı Fonksiyonlar -------------------
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

function hasConsecutiveVowels(word: string): boolean {
  const vowels = new Set(['A', 'E', 'I', 'İ', 'O', 'Ö', 'U', 'Ü']);
  for (let i = 0; i < word.length - 1; i++) {
    if (vowels.has(word[i]) && vowels.has(word[i + 1])) {
      return true;
    }
  }
  return false;
}

// Fisher-Yates shuffle algoritması
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
}


// ------------------- Optimize Edilmiş Bulmaca Oluşturma -------------------

// Tüm kelimeleri önceden işle ve bir sete at
const allWordsSet = new Set(
    Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3 && !hasConsecutiveVowels(w))
);

// Harf setlerine göre kelimeleri gruplandıran harita
const wordsByLetterSet = new Map<string, string[]>();
const seedWordsByLength = new Map<number, string[]>();

console.log('Kelime havuzu hazırlanıyor...');
for (const word of allWordsSet) {
    const letters = [...word].sort().join('');
    if (!wordsByLetterSet.has(letters)) {
        wordsByLetterSet.set(letters, []);
    }
    wordsByLetterSet.get(letters)!.push(word);

    // Ana kelime havuzlarını oluştur
    const wordLength = word.length;
    if (wordLength >= 4 && wordLength <= 7) {
        if (!seedWordsByLength.has(wordLength)) {
            seedWordsByLength.set(wordLength, []);
        }
        seedWordsByLength.get(wordLength)!.push(word);
    }
}
console.log('Kelime havuzu hazır!');

function findSubwords(letters: string[]): string[] {
    const letterKey = [...letters].sort().join('');
    const results = new Set<string>();

    for (let i = 1; i < (1 << letterKey.length); i++) {
        let subKey = '';
        for (let j = 0; j < letterKey.length; j++) {
            if ((i >> j) & 1) {
                subKey += letterKey[j];
            }
        }
        if (wordsByLetterSet.has(subKey)) {
            wordsByLetterSet.get(subKey)!.forEach(word => results.add(word));
        }
    }
    return Array.from(results);
}

function createPuzzle(difficulty: number): { letters: string[], words: string[] } | null {
    const MIN_WORD_COUNT = 4;
    const MAX_WORD_COUNT = 8;
    const MAX_ATTEMPTS = 500;

    const seedWords = seedWordsByLength.get(difficulty);
    if (!seedWords || seedWords.length === 0) {
        console.error(`Zorluk ${difficulty} için kelime bulunamadı.`);
        return null;
    }
    
    const shuffledSeeds = shuffleArray(seedWords);
    
    let bestPuzzle: { letters: string[], words: string[], score: number } | null = null;

    for (let i = 0; i < Math.min(shuffledSeeds.length, MAX_ATTEMPTS); i++) {
        const baseWord = shuffledSeeds[i];
        const letters = [...baseWord];

        const constructibleWords = findSubwords(letters);
        
        const filteredWords = constructibleWords.filter(word =>
            !constructibleWords.some(otherWord => otherWord !== word && otherWord.includes(word))
        );

        if (filteredWords.length < MIN_WORD_COUNT || filteredWords.length > MAX_WORD_COUNT) {
            continue;
        }

        const threeLetterCount = filteredWords.filter(w => w.length === 3).length;
        if (threeLetterCount > 3) continue;

        const avgLength = filteredWords.reduce((sum, w) => sum + w.length, 0) / filteredWords.length;
        const lengthVariety = new Set(filteredWords.map(w => w.length)).size;
        const score = filteredWords.length * 1.5 + avgLength * 2 + lengthVariety * 3;

        if (!bestPuzzle || score > bestPuzzle.score) {
            bestPuzzle = { letters, words: filteredWords, score };
        }
    }
    
    if (!bestPuzzle) {
        console.error(`❌ ${MAX_ATTEMPTS} denemeden sonra uygun bulmaca bulunamadı.`);
        return null;
    }

    const finalWords = bestPuzzle.words.sort((a, b) =>
        a.length - b.length || a.localeCompare(b)
    );

    console.log(`✅ Bulmaca oluşturuldu. Temel kelime: ${bestPuzzle.letters.join('')}`);
    sendToTelegram(`✅ Bulmaca: ${bestPuzzle.letters.join('')} (${finalWords.length} kelime)`);
    console.log(`🧩 Kelimeler: ${finalWords.join(', ')}`);
    sendToTelegram(`🧩 Kelimeler: ${finalWords.join(', ')}`);
    

    return { letters: bestPuzzle.letters, words: finalWords };
}

// ------------------- Socket.IO Konfigürasyonu -------------------
interface Player {
  name: string;
  score: number;
  socketId: string;
  isConnected: boolean;
}

interface GameRoom {
  puzzle: { letters: string[], words: string[] };
  players: { [playerName: string]: Player };
  foundWords: { [word: string]: string };
  difficulty: number;
}

const gameRooms: { [roomId: string]: GameRoom } = {};
const emptyRoomTimers = new Map<string, NodeJS.Timeout>();
const disconnectedPlayerTimers = new Map<string, NodeJS.Timeout>();
const socketToPlayer = new Map<string, { roomId: string, playerName: string }>();

io.on('connection', (socket) => {
  console.log(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);
  sendToTelegram(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);

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

    const playerTimerKey = `${roomId}-${playerName}`;
    if (room.players[playerName]) {
      if (disconnectedPlayerTimers.has(playerTimerKey)) {
        clearTimeout(disconnectedPlayerTimers.get(playerTimerKey)!);
        disconnectedPlayerTimers.delete(playerTimerKey);
      }
      room.players[playerName].socketId = socket.id;
      room.players[playerName].isConnected = true;
      console.log(`📞 ${playerName} (${socket.id}) "${roomId}" odasına geri döndü (Puan: ${room.players[playerName].score}).`);
      sendToTelegram(`📞 ${playerName} (${socket.id}) "${roomId}" odasına geri döndü (Puan: ${room.players[playerName].score}).`);
    } else {
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

  socket.on('sendMessage', ({ roomId, message }) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      return; 
    }

    const { playerName } = playerInfo;
    
    console.log(`💬 [${roomId}] ${playerName}: ${message}`);
    sendToTelegram(`💬 [${roomId}] ${playerName}: ${message}`);
    
    io.to(roomId).emit('newMessage', {
      playerName,
      message,
      timestamp: new Date().toISOString()
    });
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

        if (Object.values(gameRooms[roomId].players).every(p => !p.isConnected)) {
          console.log(`🚪 ${roomId} odası boş. Kapatmak için 5 dakika sayacı başlatıldı.`);
          sendToTelegram(`🚪 "${roomId}" odası boş. Kapatmak için 5 dakika sayacı başlatıldı.`);

          const roomTimer = setTimeout(() => {
            if (gameRooms[roomId] && Object.values(gameRooms[roomId].players).every(p => !p.isConnected)) {
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