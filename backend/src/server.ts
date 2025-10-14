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

/**
 * Kelimede yanyana iki sesli harf olup olmadığını kontrol eder.
 * Türkçe sesli harfler: A, E, I, İ, O, Ö, U, Ü
 */
function hasConsecutiveVowels(word: string): boolean {
  const vowels = new Set(['A', 'E', 'I', 'İ', 'O', 'Ö', 'U', 'Ü']);
  for (let i = 0; i < word.length - 1; i++) {
    if (vowels.has(word[i]) && vowels.has(word[i + 1])) {
      return true;
    }
  }
  return false;
}

function generateWordsFromLetters(
  letters: string[],
  allWords: Set<string>,
  maxWordLength: number
): Set<string> {
  const foundWords = new Set<string>();
  for (const word of allWords) {
    if (word.length >= 3 && word.length <= maxWordLength && canFormWord(word, letters) && !hasConsecutiveVowels(word)) {
      foundWords.add(word);
    }
  }
  return foundWords;
}

// ------------------- Türkçe Harf Frekansına Dayalı Kelime Kalitesi ve Çeşitlilik Mekanizması -------------------
// Türkçede en sık kullanılan harfler (frekans analizi sonuçları):
// A(11.68%), E(9.01%), İ(8.95%), N(7.15%), R(6.85%), L(5.92%), K(5.15%), M(3.76%), D(3.57%), T(3.02%)

const LETTER_SCORES: { [key: string]: number } = {
    'A': 12,   // En yüksek frekans
    'E': 9,
    'İ': 9,
    'N': 7,
    'R': 7,
    'L': 6,
    'K': 5,
    'M': 4,
    'D': 4,
    'T': 3,
    'I': 2,    // Orta seviye
    'O': 2,
    'U': 2,
    'Y': 2,
    'B': 1,
    'S': 1,
    'Ş': 1,
    'C': 1,
    'G': 0,
    'H': -1,
    'Ğ': -1,
    'Z': -2,
    'P': -3,
    'V': -4,
    'Ç': -4,
    'F': -5,
    'Ö': -6,
    'Ü': -7,
    'J': -10
};

function getWordScore(word: string): number {
    let score = 0;
    const uniqueLetters = new Set<string>();
    for (const char of word) {
        score += LETTER_SCORES[char] || 0;
        uniqueLetters.add(char);
    }
    score += uniqueLetters.size * 3;
    return score;
}

const allWordsSet = new Set(
    Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3 && !hasConsecutiveVowels(w))
);
const allWordsArray = Array.from(allWordsSet);

const scoredWords = allWordsArray.map(word => ({ word, score: getWordScore(word) }));
scoredWords.sort((a, b) => b.score - a.score);

const wordCount = scoredWords.length;
const tier1Boundary = Math.floor(wordCount * 0.20);
const tier2Boundary = Math.floor(wordCount * 0.60);

const tier1BaseWords = scoredWords.slice(0, tier1Boundary).map(item => item.word);
const tier2BaseWords = scoredWords.slice(tier1Boundary, tier2Boundary).map(item => item.word);
const tier3BaseWords = scoredWords.slice(tier2Boundary).map(item => item.word);

console.log(`Kelime havuzu hazırlandı: ${tier1BaseWords.length} yüksek, ${tier2BaseWords.length} orta, ${tier3BaseWords.length} normal kalite kelime.`);

const RECENTLY_USED_BASE_WORDS_CACHE: string[] = [];
const CACHE_SIZE_LIMIT = 250;

function addWordToCache(word: string) {
    if (RECENTLY_USED_BASE_WORDS_CACHE.length >= CACHE_SIZE_LIMIT) {
        RECENTLY_USED_BASE_WORDS_CACHE.shift();
    }
    RECENTLY_USED_BASE_WORDS_CACHE.push(word);
}

// ------------------- GÜNCELLENMIŞ: Bulmaca Oluşturma Fonksiyonu -------------------

function createPuzzle(difficulty: number): { letters: string[], words: string[] } | null {
    const MIN_WORD_COUNT = 4;
    const MAX_WORD_COUNT = 7;
    const MAX_ATTEMPTS = 5000;
    const CANDIDATE_PUZZLE_COUNT = 10;

    const getFreshWordsFromTier = (tier: string[]) =>
        tier.filter(w => w.length === difficulty && !RECENTLY_USED_BASE_WORDS_CACHE.includes(w));

    let candidateBaseWords = getFreshWordsFromTier(tier1BaseWords);
    if (candidateBaseWords.length < 20) {
        candidateBaseWords.push(...getFreshWordsFromTier(tier2BaseWords));
    }
    if (candidateBaseWords.length < 20) {
        candidateBaseWords.push(...getFreshWordsFromTier(tier3BaseWords));
    }

    if (candidateBaseWords.length === 0) {
      console.warn(`Bu zorlukta (${difficulty}) hiç taze temel kelime bulunamadı. Önbellek sıfırlanıyor.`);
      RECENTLY_USED_BASE_WORDS_CACHE.length = 0;
      candidateBaseWords = allWordsArray.filter(w => w.length === difficulty);
      if (candidateBaseWords.length === 0) return null;
    }

    const foundPuzzles: { letters: string[], words: string[], score: number, baseWord: string }[] = [];
    const shuffledCandidates = candidateBaseWords.sort(() => 0.5 - Math.random());
    
    let attempts = 0;
    let baseWord: string | undefined;

    while ((baseWord = shuffledCandidates.pop()) && attempts < MAX_ATTEMPTS && foundPuzzles.length < CANDIDATE_PUZZLE_COUNT) {
        attempts++;

        const letters = [...baseWord];
        const constructibleSet = generateWordsFromLetters(letters, allWordsSet, difficulty);
        const wordsArray = Array.from(constructibleSet);

        const filteredWords = wordsArray.filter(word =>
            !wordsArray.some(otherWord => otherWord !== word && otherWord.includes(word))
        );

        if (filteredWords.length < MIN_WORD_COUNT || filteredWords.length > MAX_WORD_COUNT) continue;

        const threeLetterWordCount = filteredWords.filter(w => w.length === 3).length;
        if (threeLetterWordCount > 2) continue;

        const score = filteredWords.length + (filteredWords.reduce((sum, w) => sum + w.length, 0) / 10);
        foundPuzzles.push({ letters, words: filteredWords, score, baseWord });
    }

    if (foundPuzzles.length === 0) {
        console.error(`❌ Hiç uygun bulmaca bulunamadı.`);
        return null;
    }

    foundPuzzles.sort((a, b) => b.score - a.score);
    const bestPuzzle = foundPuzzles[0]!;

    addWordToCache(bestPuzzle.baseWord);

    const finalWords = bestPuzzle.words.sort((a, b) => a.length - b.length || a.localeCompare(b));

    console.log(`✅ En iyi bulmaca bulundu (${foundPuzzles.length} aday arasından). Temel kelime: ${bestPuzzle.baseWord} (Kalite: ${getWordScore(bestPuzzle.baseWord).toFixed(0)})`);
    sendToTelegram(`✅ Bulmaca bulundu. Temel: ${bestPuzzle.baseWord}`);
    console.log(`Harfler: ${bestPuzzle.letters.join(', ')}`);
    console.log(`Kelimeler (${finalWords.length}): ${finalWords.join(', ')}`);
    sendToTelegram(`Kelimeler (${finalWords.length}): ${finalWords.join(', ')}`);

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