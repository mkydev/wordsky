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

      const wordsArray = Array.from(constructibleSet);

      // --- 1. ADIM: İÇ İÇE KELİME KONTROLÜ ---
      const filteredWords = wordsArray.filter(word => {
        return !wordsArray.some(otherWord => 
          otherWord !== word && otherWord.includes(word)
        );
      });

      // --- 2. ADIM: FİLTRELENMİŞ KELİME SAYISI KONTROLÜ ---
      if (filteredWords.length < MIN_WORD_COUNT || filteredWords.length > MAX_WORD_COUNT) {
        continue;
      }

      // --- 3. ADIM: 3 HARFLİ KELİME KONTROLÜ ---
      const threeLetterWordCount = filteredWords.filter(w => w.length === 3).length;
      if (threeLetterWordCount > 2) {
        continue;
      }

      // --- TÜM KONTROLLERDEN GEÇTİ, BULMACAYI OLUŞTUR ---
      const finalWords = filteredWords.sort((a, b) => a.length - b.length || a.localeCompare(b));
      
      console.log(`✅ Bulmaca bulundu (attempt ${attempt + 1})`);
      console.log(`Harfler: ${letters.join(', ')}`);
      console.log(`Kelimeler (${finalWords.length}): ${finalWords.join(', ')}`);
      console.log('-----------------------------');

      return { letters, words: finalWords };
    }

    console.error(`❌ Hiç uygun bulmaca bulunamadı (${MIN_WORD_COUNT}-${MAX_WORD_COUNT} kelime ve en fazla 2 adet 3 harfli kelime).`);
    return null;
}

// ------------------- Socket.IO Mantığı -------------------
interface Player {
  playerId: string;
  name: string;
  score: number;
  socketId: string;
  isConnected: boolean;
}

interface GameRoom {
  puzzle: { letters: string[], words: string[] };
  players: { [playerId: string]: Player };
  foundWords: { [word: string]: string };
  difficulty: number;
}

const gameRooms: { [roomId: string]: GameRoom } = {};
const emptyRoomTimers = new Map<string, NodeJS.Timeout>();
const disconnectedPlayerTimers = new Map<string, NodeJS.Timeout>();
const socketToPlayer = new Map<string, { roomId: string, playerId: string }>();

// Benzersiz oyuncu ID oluştur
function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Oyuncu ismine 3 haneli rastgele sayı ekle
function addRandomSuffixToName(name: string): string {
  const randomNumber = Math.floor(Math.random() * 900) + 100; // 100-999 arası
  return `${name}-${randomNumber}`;
}

io.on('connection', (socket) => {
  console.log(`✨ Yeni bir kullanıcı bağlandı: ${socket.id}`);

  socket.on('createRoom', ({ difficulty, roomName, playerName }) => {
    if (emptyRoomTimers.has(roomName)) {
        clearTimeout(emptyRoomTimers.get(roomName)!);
        emptyRoomTimers.delete(roomName);
        console.log(`⏰ ${roomName} odası için kapatma sayacı iptal edildi.`);
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

    const playerId = generatePlayerId();
    const displayName = addRandomSuffixToName(playerName);
    
    gameRooms[roomName] = {
      puzzle,
      players: {
        [playerId]: { playerId, name: displayName, score: 0, socketId: socket.id, isConnected: true }
      },
      foundWords: {},
      difficulty: difficulty
    };

    socketToPlayer.set(socket.id, { roomId: roomName, playerId });
    socket.join(roomName);
    
    console.log(`🚪 ${displayName} (${playerId}) kullanıcısı "${roomName}" odasını oluşturdu.`);
    socket.emit('roomCreated', { roomId: roomName, playerId, puzzle, players: gameRooms[roomName].players });
  });

  socket.on('joinRoom', ({ roomId, playerName, playerId }) => {
    if (emptyRoomTimers.has(roomId)) {
        clearTimeout(emptyRoomTimers.get(roomId)!);
        emptyRoomTimers.delete(roomId);
        console.log(`⏰ ${roomId} odası için kapatma sayacı iptal edildi.`);
    }

    const room = gameRooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Oda bulunamadı.' });
      return;
    }

    socket.join(roomId);

    // Eğer playerId verilmişse ve oyuncu odadaysa (yeniden bağlanma)
    if (playerId && room.players[playerId]) {
      const playerTimerKey = `${roomId}-${playerId}`;
      
      // Disconnect zamanlayıcısını iptal et
      if (disconnectedPlayerTimers.has(playerTimerKey)) {
        clearTimeout(disconnectedPlayerTimers.get(playerTimerKey)!);
        disconnectedPlayerTimers.delete(playerTimerKey);
      }
      
      // Socket ID'yi güncelle ve bağlantıyı aktif yap
      room.players[playerId].socketId = socket.id;
      room.players[playerId].isConnected = true;
      socketToPlayer.set(socket.id, { roomId, playerId });
      
      console.log(`🔄 ${room.players[playerId].name} (${playerId}) "${roomId}" odasına geri döndü (Puan: ${room.players[playerId].score}).`);
      
      socket.emit('joinSuccess', { roomId, playerId });
    } else {
      // Yeni oyuncu - yeni playerId oluştur ve isme rastgele sayı ekle
      const newPlayerId = generatePlayerId();
      const displayName = addRandomSuffixToName(playerName);
      
      room.players[newPlayerId] = { playerId: newPlayerId, name: displayName, score: 0, socketId: socket.id, isConnected: true };
      socketToPlayer.set(socket.id, { roomId, playerId: newPlayerId });
      
      console.log(`➡️ ${displayName} (${newPlayerId}) "${roomId}" odasına katıldı.`);
      
      socket.emit('joinSuccess', { roomId, playerId: newPlayerId });
    }
    
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

    const playerId = playerInfo.playerId;
    room.players[playerId].score += normalizedWord.length;
    room.foundWords[normalizedWord] = playerId;

    const allWordsFound = Object.keys(room.foundWords).length === room.puzzle.words.length;

    if (allWordsFound) {
      console.log(`🎉 "${roomId}" odasındaki bulmaca tamamlandı! Yeni bulmaca oluşturuluyor...`);
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
    
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) return;

    const { roomId, playerId } = playerInfo;
    const room = gameRooms[roomId];
    
    if (!room || !room.players[playerId]) return;

    const player = room.players[playerId];
    player.isConnected = false;
    
    console.log(`⏳ ${player.name} "${roomId}" odasından geçici olarak ayrıldı (Puan: ${player.score}). 5 dakika bekleniyor...`);

    const playerTimerKey = `${roomId}-${playerId}`;
    const timer = setTimeout(() => {
      if (gameRooms[roomId] && gameRooms[roomId].players[playerId] && !gameRooms[roomId].players[playerId].isConnected) {
        const disconnectedPlayer = gameRooms[roomId].players[playerId];
        delete gameRooms[roomId].players[playerId];
        console.log(`🗑️ ${disconnectedPlayer.name} 5 dakika içinde geri dönmediği için "${roomId}" odasından çıkarıldı.`);
        
        io.to(roomId).emit('playerLeft', { players: gameRooms[roomId].players });
        
        // Oda boş kaldıysa
        if (Object.keys(gameRooms[roomId].players).length === 0) {
          console.log(`🚪 ${roomId} odası boş. Kapatmak için 5 dakika sayacı başlatıldı.`);
          
          const roomTimer = setTimeout(() => {
            if (gameRooms[roomId] && Object.keys(gameRooms[roomId].players).length === 0) {
              delete gameRooms[roomId];
              console.log(`🗑️ ${roomId} odası 5 dakika boş kaldığı için kapatıldı.`);
            }
            emptyRoomTimers.delete(roomId);
          }, 300000);
    
          emptyRoomTimers.set(roomId, roomTimer);
        }
      }
      disconnectedPlayerTimers.delete(playerTimerKey);
    }, 300000);

    disconnectedPlayerTimers.set(playerTimerKey, timer);
    socketToPlayer.delete(socket.id);
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