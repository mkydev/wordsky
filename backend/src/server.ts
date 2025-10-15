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

// ------------------- İYİLEŞTİRİLMİŞ: Kelime Havuzu ve Çeşitlilik -------------------
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

interface WordStats {
  word: string;
  score: number;
  uniqueLetterCount: number;
  vowelConsonantRatio: number;
}

// Gelişmiş kelime skoru hesaplama
function getAdvancedWordScore(word: string): WordStats {
  let score = 0;
  const uniqueLetters = new Set<string>();
  const vowels = new Set(['A', 'E', 'I', 'İ', 'O', 'Ö', 'U', 'Ü']);
  let vowelCount = 0;

  for (const char of word) {
    score += LETTER_SCORES[char] || 0;
    uniqueLetters.add(char);
    if (vowels.has(char)) vowelCount++;
  }

  // Bonus puanlar
  score += uniqueLetters.size * 5; // Çeşitlilik bonusu artırıldı
  
  // Sesli-sessiz dengesi bonusu (ideal: ~40% sesli)
  const vowelRatio = vowelCount / word.length;
  const idealVowelRatio = 0.4;
  const balanceBonus = 10 * (1 - Math.abs(vowelRatio - idealVowelRatio));
  score += balanceBonus;

  return {
    word,
    score,
    uniqueLetterCount: uniqueLetters.size,
    vowelConsonantRatio: vowelRatio
  };
}

// Tüm kelimeleri normalize et ve filtrele
const allWordsSet = new Set(
    Object.values(turkishWords)
      .flat()
      .map(normalize)
      .filter(w => w.length >= 3 && !hasConsecutiveVowels(w))
);
const allWordsArray = Array.from(allWordsSet);

// Kelime havuzunu daha dengeli katmanlara ayır
const allWordsStats = allWordsArray.map(getAdvancedWordScore);
allWordsStats.sort((a, b) => b.score - a.score);

// Zorluk bazlı havuzlar oluştur
const wordsByLength: Map<number, WordStats[]> = new Map();
for (const ws of allWordsStats) {
  if (!wordsByLength.has(ws.word.length)) {
    wordsByLength.set(ws.word.length, []);
  }
  wordsByLength.get(ws.word.length)!.push(ws);
}

// Her uzunluk için tier'ları ayır
const tiersByLength: Map<number, { tier1: string[], tier2: string[], tier3: string[] }> = new Map();
for (const [length, words] of wordsByLength) {
  const count = words.length;
  const t1Boundary = Math.floor(count * 0.25);
  const t2Boundary = Math.floor(count * 0.65);

  tiersByLength.set(length, {
    tier1: words.slice(0, t1Boundary).map(w => w.word),
    tier2: words.slice(t1Boundary, t2Boundary).map(w => w.word),
    tier3: words.slice(t2Boundary).map(w => w.word)
  });
}

console.log('Kelime havuzu hazırlandı:');
for (const [length, tiers] of tiersByLength) {
  console.log(`  ${length} harf: ${tiers.tier1.length} üst, ${tiers.tier2.length} orta, ${tiers.tier3.length} alt kalite`);
}

// Önbellek boyutunu artır ve zorluk bazlı yap
const RECENTLY_USED_CACHE = new Map<number, Set<string>>();
const CACHE_SIZE_LIMIT = 1500; // 250'den 1500'e çıkarıldı

function addToCache(difficulty: number, word: string) {
  if (!RECENTLY_USED_CACHE.has(difficulty)) {
    RECENTLY_USED_CACHE.set(difficulty, new Set());
  }
  
  const cache = RECENTLY_USED_CACHE.get(difficulty)!;
  cache.add(word);
  
  // Önbellek doluysa en eski %20'yi temizle
  if (cache.size > CACHE_SIZE_LIMIT) {
    const toRemove = Math.floor(CACHE_SIZE_LIMIT * 0.2);
    const entries = Array.from(cache);
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i]!);
    }
  }
}

function isInCache(difficulty: number, word: string): boolean {
  return RECENTLY_USED_CACHE.get(difficulty)?.has(word) ?? false;
}

// ------------------- GÜNCELLENMIŞ: Akıllı Bulmaca Oluşturma -------------------

function createPuzzle(difficulty: number): { letters: string[], words: string[] } | null {
  const MIN_WORD_COUNT = 4;
  const MAX_WORD_COUNT = 7;
  const MAX_ATTEMPTS = 8000; // 5000'den artırıldı
  const CANDIDATE_PUZZLE_COUNT = 25; // 10'dan artırıldı

  const tiers = tiersByLength.get(difficulty);
  if (!tiers) {
    console.error(`Zorluk ${difficulty} için kelime havuzu bulunamadı.`);
    return null;
  }

  // Önbellekte olmayan kelimeleri bul
  const getFreshWords = (tier: string[]) => 
    tier.filter(w => !isInCache(difficulty, w));

  let candidateBaseWords = getFreshWords(tiers.tier1);
  
  // Tier 1 yetersizse karıştırarak tier 2 ekle
  if (candidateBaseWords.length < 50) {
    candidateBaseWords.push(...getFreshWords(tiers.tier2));
  }
  
  // Hala yetersizse tier 3 ekle
  if (candidateBaseWords.length < 50) {
    candidateBaseWords.push(...getFreshWords(tiers.tier3));
  }

  // Hiç kelime yoksa önbelleği sıfırla
  if (candidateBaseWords.length === 0) {
    console.warn(`${difficulty} harf için taze kelime yok. Önbellek temizleniyor.`);
    RECENTLY_USED_CACHE.delete(difficulty);
    candidateBaseWords = [...tiers.tier1, ...tiers.tier2, ...tiers.tier3];
  }

  // Kelimeleri karıştır (daha iyi çeşitlilik için)
  const shuffledCandidates = candidateBaseWords
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(candidateBaseWords.length, 500)); // En fazla 500 adaydan seç

  interface PuzzleCandidate {
    letters: string[];
    words: string[];
    score: number;
    baseWord: string;
    diversity: number;
  }

  const foundPuzzles: PuzzleCandidate[] = [];
  let attempts = 0;

  for (const baseWord of shuffledCandidates) {
    if (attempts >= MAX_ATTEMPTS || foundPuzzles.length >= CANDIDATE_PUZZLE_COUNT) {
      break;
    }
    attempts++;

    const letters = [...baseWord];
    const constructibleSet = generateWordsFromLetters(letters, allWordsSet, difficulty);
    const wordsArray = Array.from(constructibleSet);

    // Alt-kelime içerenleri filtrele
    const filteredWords = wordsArray.filter(word =>
      !wordsArray.some(otherWord => otherWord !== word && otherWord.includes(word))
    );

    if (filteredWords.length < MIN_WORD_COUNT || filteredWords.length > MAX_WORD_COUNT) {
      continue;
    }

    // 3 harfli kelime kontrolü
    const threeLetterCount = filteredWords.filter(w => w.length === 3).length;
    if (threeLetterCount > 2) continue;

    // Çeşitlilik skoru: farklı uzunluklardaki kelime sayısı
    const lengthSet = new Set(filteredWords.map(w => w.length));
    const diversity = lengthSet.size;

    // Toplam skor: kelime sayısı + uzunluk bonusu + çeşitlilik bonusu
    const lengthBonus = filteredWords.reduce((sum, w) => sum + w.length, 0) / 10;
    const diversityBonus = diversity * 2;
    const score = filteredWords.length + lengthBonus + diversityBonus;

    foundPuzzles.push({
      letters,
      words: filteredWords,
      score,
      baseWord,
      diversity
    });
  }

  if (foundPuzzles.length === 0) {
    console.error(`❌ ${attempts} denemeden sonra uygun bulmaca bulunamadı.`);
    return null;
  }

  // En iyi bulmacayı seç (skor + çeşitlilik)
  foundPuzzles.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.5) return scoreDiff;
    return b.diversity - a.diversity;
  });

  const bestPuzzle = foundPuzzles[0]!;
  addToCache(difficulty, bestPuzzle.baseWord);

  const finalWords = bestPuzzle.words.sort((a, b) => 
    a.length - b.length || a.localeCompare(b)
  );

  console.log(`✅ Bulmaca bulundu (${foundPuzzles.length} aday, ${attempts} deneme)`);
  console.log(`   Temel: ${bestPuzzle.baseWord} | Kelime: ${finalWords.length} | Çeşitlilik: ${bestPuzzle.diversity}`);
  sendToTelegram(`✅ Bulmaca: ${bestPuzzle.baseWord} (${finalWords.length} kelime)`);
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