<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import LetterCircle from './components/LetterCircle.vue';
import WordDisplay from './components/WordDisplay.vue';
import SplashScreen from './components/SplashScreen.vue';
import { useCrossword } from './composables/useCrossword';
import { io } from 'socket.io-client';

// --- Splash Screen ---
const showSplash = ref(true);

// --- Temel Değişkenler ---
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const socket = io(apiUrl);

const apiWords = ref<string[]>([]);
const letters = ref<string[]>([]);
const difficulty = ref<4 | 5 | 6 | 7>(4);
const loading = ref(false);
const error = ref<string | null>(null);
const gameStarted = ref(false);
const currentSelectedWord = ref<string>('');

// --- Oyuncu ve İsim Yönetimi ---
const playerName = ref('');
const tempPlayerName = ref('');
const showNameInput = ref(true);

// --- Tek Oyunculu Mod için ---
const localFoundWords = ref<string[]>([]);

// --- Çok Oyunculu Mod için ---
const isMultiplayer = ref(false);
const roomId = ref<string | null>(null);
const roomIdToJoin = ref('');
const customRoomNameToCreate = ref('');
const players = ref<Record<string, { name: string, score: number }>>({});
const multiplayerFoundWords = ref<Record<string, string>>({});
const showGameInfoPopup = ref(false);
const copied = ref(false);
const isTransitioningToNextRound = ref(false);
const isChatOpen = ref(false);
const messages = ref<{ playerName: string, message: string, timestamp: string }[]>([]);
const newMessage = ref('');

// --- Crossword ve Kelime Yönetimi ---
const { grid, placedWords } = useCrossword(computed(() => apiWords.value));
const words = computed(() => placedWords.value.map(p => p.word.toUpperCase()));
const foundWords = computed(() => {
  return isMultiplayer.value ? Object.keys(multiplayerFoundWords.value) : localFoundWords.value;
});

// Oyuncu ismini kaydet ve ana menüye geç
function setPlayerName() {
  if (tempPlayerName.value.trim()) {
    playerName.value = tempPlayerName.value.trim();
    localStorage.setItem('wordsky_playerName', playerName.value);
    socket.emit('playerNameCreated', playerName.value); // Loglama için backend'e olay gönder
    showNameInput.value = false;
  }
}

// --- Tek Oyunculu Oyun Fonksiyonu ---
async function createNewPuzzle(diff: 4 | 5 | 6 | 7) {
  isMultiplayer.value = false;
  difficulty.value = diff;
  loading.value = true;
  error.value = null;
  gameStarted.value = true;
  localFoundWords.value = [];
  apiWords.value = [];

  try {
    const response = await fetch(`${apiUrl}/api/v1/puzzles/random?difficulty=${diff}`);
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Bulmaca oluşturulamadı.');
    }
    const data = await response.json();
    if (!data.words || data.words.length === 0) {
      throw new Error('Bu zorlukta uygun bir bulmaca bulunamadı, lütfen tekrar deneyin.');
    }
    letters.value = data.letters;
    shuffleLetters();
    apiWords.value = data.words;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

// --- Çok Oyunculu Oyun Fonksiyonları ---
function createMultiplayerGame(diff: 4 | 5 | 6 | 7) {
  if (!customRoomNameToCreate.value.trim()) {
    error.value = "Lütfen bir oda adı girin.";
    setTimeout(() => error.value = null, 3000);
    return;
  }
  loading.value = true;
  error.value = null;
  isMultiplayer.value = true;
  socket.emit('createRoom', {
    difficulty: diff,
    roomName: customRoomNameToCreate.value.trim(),
    playerName: playerName.value
  });
}

function joinMultiplayerGame() {
  if (roomIdToJoin.value.trim()) {
    loading.value = true;
    error.value = null;
    isMultiplayer.value = true;
    socket.emit('joinRoom', {
      roomId: roomIdToJoin.value.trim(),
      playerName: playerName.value
    });
  }
}

function toggleGameInfoPopup() {
  showGameInfoPopup.value = !showGameInfoPopup.value;
}

function copyRoomId() {
  if (roomId.value) {
    navigator.clipboard.writeText(roomId.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }
}

// --- Genel Oyun Fonksiyonları ---
function goBackToMenu() {
  gameStarted.value = false;
  isMultiplayer.value = false;
  apiWords.value = [];
  letters.value = [];
  roomId.value = null;
  players.value = {};
  multiplayerFoundWords.value = {};
  localFoundWords.value = [];
  error.value = null;
  messages.value = [];
}

watch(roomId, () => {
  messages.value = [];
});

watch(currentSelectedWord, (newWord: string) => {
  if (!newWord || !words.value.includes(newWord.toUpperCase()) || foundWords.value.includes(newWord.toUpperCase())) {
    return;
  }
  if (isMultiplayer.value && roomId.value) {
    socket.emit('wordFound', { roomId: roomId.value, word: newWord.toUpperCase() });
  } else {
    localFoundWords.value.push(newWord.toUpperCase());
  }
});

const allWordsFound = computed(() => {
  if (words.value.length === 0) return false;
  return words.value.length === foundWords.value.length;
});

watch(allWordsFound, async (newVal) => {
  if (newVal && !isMultiplayer.value && gameStarted.value) {
    // 2.5 saniye bekle (tebrik mesajını göster)
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Yeni bulmaca oluştur
    await createNewPuzzle(difficulty.value);
  }
});

function shuffleLetters() {
  for (let i = letters.value.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters.value[i], letters.value[j]] = [letters.value[j]!, letters.value[i]!];
  }
}

function sendMessage() {
  if (newMessage.value.trim() && roomId.value) {
    socket.emit('sendMessage', {
      roomId: roomId.value,
      message: newMessage.value.trim(),
    });
    newMessage.value = '';
  }
}

// --- Socket ve Lifecycle Olayları ---
onMounted(() => {
  setTimeout(() => {
    showSplash.value = false;
  }, 1500);

  const savedName = localStorage.getItem('wordsky_playerName');
  if (savedName) {
    playerName.value = savedName;
    showNameInput.value = false;
  }

  socket.on('roomCreated', (data) => {
    roomId.value = data.roomId;
    letters.value = data.puzzle.letters;
    shuffleLetters();
    apiWords.value = data.puzzle.words;
    players.value = data.players;
    gameStarted.value = true;
    loading.value = false;
  });

  socket.on('gameUpdate', (data) => {
    if (!gameStarted.value) {
      letters.value = data.puzzle.letters;
      shuffleLetters();
      apiWords.value = data.puzzle.words;
      gameStarted.value = true;
    }
    players.value = data.players;
    multiplayerFoundWords.value = data.foundWords as Record<string, string>;
    loading.value = false;
  });

  socket.on('newRound', (data) => {
    isTransitioningToNextRound.value = true;

    setTimeout(() => {
      letters.value = data.puzzle.letters;
      shuffleLetters();
      apiWords.value = data.puzzle.words;
      players.value = data.players;
      multiplayerFoundWords.value = {};

      setTimeout(() => {
        isTransitioningToNextRound.value = false;
      }, 500);
    }, 1000);
  });

  socket.on('joinSuccess', (data) => { roomId.value = data.roomId; });
  socket.on('playerJoined', (data) => { players.value = data.players; });
  socket.on('playerLeft', (data) => { players.value = data.players; });

  socket.on('newMessage', (message) => {
    messages.value.push(message);
  });

  socket.on('error', (data) => {
    error.value = data.message;
    loading.value = false;
    setTimeout(() => {
      if (gameStarted.value && isMultiplayer.value) { goBackToMenu(); }
      error.value = null;
    }, 3000);
  });
});

// --- Tema Yönetimi ---
const themes = [
  { name: 'Default', class: 'default', color: '#2c3e50' },
  { name: 'Blue', class: 'theme-baby-blue', color: '#A1C9F4' },
  { name: 'Yaren', class: 'theme-purple', color: '#4a148c' },
  { name: 'Orange', class: 'theme-orange', color: '#e65100' },
  { name: 'Green', class: 'theme-walnut-green', color: '#556B2F' },


];
const currentThemeIndex = ref(0);
const currentTheme = computed(() => themes[currentThemeIndex.value]!.class);
const showThemeSelector = ref(false);

function toggleThemeSelector() { showThemeSelector.value = !showThemeSelector.value; }
function selectTheme(index: number) { currentThemeIndex.value = index; showThemeSelector.value = false; }

watch(currentTheme, (newTheme, oldTheme) => {
  if (oldTheme && oldTheme !== 'default') document.body.classList.remove(oldTheme);
  if (newTheme && newTheme !== 'default') document.body.classList.add(newTheme);
}, { immediate: true });

watch(currentThemeIndex, (newIndex) => {
  const theme = themes[newIndex];
  if (theme) {
    const meta = document.querySelector('#theme-color-meta');
    if (meta) meta.setAttribute('content', theme.color);
  }
}, { immediate: true });
</script>

<template>
  <SplashScreen v-if="showSplash" />
  <main :class="currentTheme">
    <div v-if="showNameInput" class="popup-overlay">
      <div class="name-input-popup">
        <h2>Oyuna Hoş Geldin!</h2>
        <p>Lütfen ismini girerek başla.</p>
        <input
          type="text"
          v-model="tempPlayerName"
          placeholder="İsmin"
          class="room-input"
          maxlength="12"
          @keyup.enter="setPlayerName"
        />
        <button @click="setPlayerName" class="join-btn">Oyuna Başla</button>
      </div>
    </div>

    <header v-if="!showNameInput">
      <h1>WordYK</h1>
      <div class="header-actions">
        <button v-if="gameStarted && isMultiplayer" @click="toggleGameInfoPopup" class="header-btn">👥</button>
        <div class="theme-switcher-container">
          <button @click="toggleThemeSelector" class="header-btn">🎨</button>
          <div v-if="showThemeSelector" class="theme-selector-popover">
            <button v-for="(theme, index) in themes" :key="theme.class" @click="selectTheme(index)" class="theme-option">
              <span class="theme-color-dot" :style="{ backgroundColor: theme.color }"></span>
              <span>{{ theme.name }}</span>
            </button>
          </div>
        </div>
      </div>
      <button v-if="gameStarted" @click="goBackToMenu" class="back-button">←</button>
    </header>

    <div v-if="!gameStarted && !showNameInput" class="level-selector">
      <div class="difficulty-selector">
        <h2>Tek Oyunculu</h2>
        <div class="difficulty-buttons">
          <button v-for="diff in [4, 5, 6, 7]" :key="diff" @click="createNewPuzzle(diff as 4 | 5 | 6 | 7)" class="difficulty-btn">
            {{ diff }} Harf
          </button>
        </div>
      </div>
      <div class="multiplayer-menu">
        <h2>Çok Oyunculu</h2>
        <div class="join-room-container">
          <input type="text" v-model="roomIdToJoin" placeholder="Oda Adı ile Katıl" class="room-input" @keyup.enter="joinMultiplayerGame"/>
          <button @click="joinMultiplayerGame" class="join-btn">Katıl</button>
        </div>
        <p>veya yeni bir oda kur:</p>
        <div class="create-room-container">
          <input type="text" v-model="customRoomNameToCreate" placeholder="Yeni Oda Adı" class="room-input"/>
          <div class="difficulty-buttons-mp">
            <button v-for="diff in [4, 5, 6, 7]" :key="`mp-${diff}`" @click="createMultiplayerGame(diff as 4 | 5 | 6 | 7)" class="difficulty-btn-mp">
              {{ diff }}H
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="game-area">
      <Transition name="fade">
        <div v-if="isTransitioningToNextRound" class="popup-overlay transition-screen">
          <h3>Yeni Tur Hazırlanıyor...</h3>
        </div>
      </Transition>

      <div v-if="loading" class="loading">Yükleniyor...</div>
      <div v-if="error" class="error">{{ error }}</div>
      <template v-if="!loading && !error && words.length > 0">
        <div v-if="allWordsFound && !isTransitioningToNextRound" class="success-message">
          <h3 v-if="isMultiplayer">
          Tebrikler, turu tamamladınız!<br>
          <small>Yeni tur hazırlanıyor...</small>
          </h3>
          <h3 v-else>Tebrikler! Tüm kelimeleri buldunuz!</h3>
        </div>

        <template v-else-if="!allWordsFound">
          <div v-if="showGameInfoPopup" class="popup-overlay" @click.self="toggleGameInfoPopup">
            <div class="game-info-popup">
              <button @click="toggleGameInfoPopup" class="close-popup-btn">×</button>
              <div v-if="isMultiplayer && roomId" class="popup-section">
                <h3>Oda Bilgisi</h3>
                <p>Bu oda adını arkadaşlarınla paylaşarak odaya davet et.</p>
                <div class="room-id-container" style="display: flex; align-items: center; gap: 0.8rem; margin-top: 0.5rem;">
                  <strong class="room-id">{{ roomId }}</strong>
                  <button @click="copyRoomId" class="copy-btn">
                    {{ copied ? 'Kopyalandı!' : 'Kopyala' }}
                  </button>
                </div>
              </div>
              <div v-if="isMultiplayer" class="popup-section">
                <h3>Oyuncular</h3>
                <ul class="popup-players-list">
                  <li v-for="player in players" :key="player.name">
                    <span>{{ player.name }}</span>
                    <span class="player-score">{{ player.score }} Puan</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="game-container">
            <div class="word-display-section">
              <WordDisplay :grid="grid" :placed-words="placedWords" :found-words="foundWords" />
            </div>
            <div class="right-panel">
                <div class="letter-circle-section">
                    <LetterCircle :letters="letters" v-model:current-selected-word="currentSelectedWord" @shuffle="shuffleLetters" />
                    <div class="chat-bubble-container">
                      <button v-if="isMultiplayer" @click="isChatOpen = !isChatOpen" class="chat-bubble-button">
                        <span class="chat-icon">💬</span>
                      </button>
                    </div>
                </div>

                <div v-if="isChatOpen" class="chat-popup-overlay" @click.self="isChatOpen = false">
                  <div v-if="isMultiplayer" class="chat-container">
                    <div class="chat-header">
                      <h3>Sohbet</h3>
                      <button @click="isChatOpen = false" class="close-chat-btn">×</button>
                    </div>
                    <div class="chat-body">
                      <div v-for="(msg, index) in messages" :key="index" class="message" :class="{ 'my-message': msg.playerName === playerName }">
                        <div class="message-sender" v-if="msg.playerName !== playerName">{{ msg.playerName }}</div>
                        <div class="message-content">{{ msg.message }}</div>
                        <div class="message-time">{{ new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
                      </div>
                      <div v-if="messages.length === 0" class="no-messages">
                        Henüz hiç mesaj yok.
                      </div>
                    </div>
                    <div class="chat-footer">
                      <input type="text" v-model="newMessage" placeholder="Mesajını yaz..." class="chat-input" @keyup.enter="sendMessage" />
                      <button @click="sendMessage" class="send-btn">Gönder</button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </main>
</template>

<style scoped>
/* Mevcut Stilleriniz... */
main { display: flex; flex-direction: column; height: 100vh; max-height: 100vh; font-family: sans-serif; background-color: var(--background-color); color: var(--text-color); box-sizing: border-box; padding: 0 1rem; overflow: hidden; transition: background-color 0.3s, color 0.3s; }
header { display: flex; align-items: center; justify-content: center; padding: 0.7rem 1rem; flex-shrink: 0; position: relative; width: 100%; box-sizing: border-box; }
.back-button { background: var(--button-bg); border: 1px solid var(--button-border); color: var(--text-color); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; transition: all 0.2s ease; position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); }
.header-actions { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 0.5rem; }
.header-btn { background: var(--button-bg); border: 1px solid var(--button-border); color: var(--text-color); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; transition: all 0.2s ease; }
.theme-switcher-container { position: relative; } /* Konumlandırma için eklendi */
.theme-selector-popover { position: absolute; top: 50px; right: 0; background-color: var(--background-color); border: 1px solid var(--button-border); border-radius: 8px; padding: 0.5rem; z-index: 10; display: flex; flex-direction: column; gap: 0.5rem; } /* Flex özellikleri eklendi */
.theme-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: none;
  border: none;
  color: var(--text-color);
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.theme-option:hover { background-color: var(--button-hover-bg); }
.theme-color-dot {
  width: 16px; /* DÜZELTME: Boyut eklendi */
  height: 16px; /* DÜZELTME: Boyut eklendi */
  border-radius: 50%;
  border: 1px solid var(--button-border); /* DÜZELTME: Sınır eklendi */
}
h1 { font-size: clamp(1.1rem, 4.5vw, 1.8rem); margin: 0; text-align: center; flex-grow: 1; padding: 0 110px; box-sizing: border-box; }
.level-selector { flex: 1; display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 2rem; width: 100%; max-width: 800px; margin: 0 auto; padding: 1rem; }
.difficulty-selector, .multiplayer-menu { text-align: center; width: 100%; }
.difficulty-selector h2, .multiplayer-menu h2 { color: var(--text-color); margin-bottom: 1.5rem; font-size: clamp(1.2rem, 4vw, 1.8rem); }
.difficulty-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

.difficulty-btn {
  background: var(--button-bg);
  border: 2px solid var(--button-border);
  color: var(--text-color);
  padding: 1.5rem 2rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: bold;
  transition: all 0.3s ease;
  min-width: 140px;
}
.difficulty-btn:hover {
  background: var(--button-hover-bg);
  transform: translateY(-2px);
}

.multiplayer-menu { border-top: 2px solid var(--button-border); padding-top: 2rem; max-width: 450px; }
.join-room-container { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.create-room-container { display: flex; flex-direction: column; gap: 0.75rem; }
.difficulty-buttons-mp { display: flex; gap: 0.5rem; justify-content: center; }
.room-input { flex-grow: 1; padding: 0.8rem; border: 1px solid var(--button-border); border-radius: 8px; background-color: var(--background-color); color: var(--text-color); font-size: 1rem; }
.join-btn { padding: 0.8rem 1rem; border: none; border-radius: 8px; background-color: var(--success-color); color: white; font-weight: bold; cursor: pointer; }
.difficulty-btn-mp { background: var(--button-bg); border: 1px solid var(--button-border); color: var(--text-color); padding: 0.8rem 1rem; border-radius: 8px; font-size: 1rem; cursor: pointer; flex-grow: 1; }
.game-area { flex-grow: 1; display: flex; flex-direction: column; min-height: 0; }
.game-container { display: flex; flex-direction: column; flex: 1; gap: 0.5rem; padding: 0 0.5rem 0.5rem 0.5rem; min-height: 0; overflow: hidden; }
.word-display-section { flex: 0 1 auto; width: 100%; max-height: 55vh; display: flex; justify-content: center; align-items: center; overflow: hidden; padding-top: 0.1rem; }
.right-panel { display: flex; flex-direction: column; gap: 1rem; flex-grow: 1; }
.letter-circle-section { flex-shrink: 0; position: relative; }

/* Chat Bubble Stilleri */
.chat-bubble-container {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 10;
}
.chat-bubble-button {
  background-color: var(--success-color);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 1.2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

/* Chat Popup Stilleri */
.chat-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  padding: 1rem;
}

.chat-container {
  width: 100%;
  max-width: 500px;
  height: 70vh;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  background-color: var(--background-color-soft);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--button-border);
}

@media (max-width: 768px) {
  .chat-container {
    height: 80vh;
    max-height: 500px;
  }
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: var(--background-color);
  border-bottom: 1px solid var(--button-border);
}

.chat-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.close-chat-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-color);
  cursor: pointer;
}

.chat-body {
  flex-grow: 1;
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  width: fit-content;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  background-color: var(--button-bg);
  align-self: flex-start;
}
.message.my-message {
  align-self: flex-end;
  background-color: var(--success-color);
  color: white;
}
.message-sender {
  font-size: 0.75rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
  color: var(--text-color-muted);
}
.my-message .message-sender {
  display: none;
}
.message-content {
  font-size: 0.9rem;
  word-wrap: break-word;
}
.message-time {
  font-size: 0.7rem;
  align-self: flex-end;
  margin-top: 0.2rem;
  opacity: 0.7;
}
.no-messages {
  text-align: center;
  color: var(--text-color-muted);
  font-size: 0.9rem;
  margin: auto;
}
.chat-footer {
  display: flex;
  padding: 0.5rem;
  border-top: 1px solid var(--button-border);
  gap: 0.5rem;
}
.chat-input {
  flex-grow: 1;
  border: none;
  background-color: var(--background-color);
  color: var(--text-color);
  padding: 0.6rem;
  border-radius: 8px;
  font-size: 16px; /* Prevent mobile zoom */
}
.chat-input:focus {
  outline: 1px solid var(--success-color);
}
.send-btn {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  background-color: var(--success-color);
  color: white;
  font-weight: bold;
  cursor: pointer;
}
.loading, .error { text-align: center; padding: 2rem; font-size: 1.2rem; color: var(--error-color); }
.success-message { text-align: center; margin: 2rem; }
.success-message h2 { font-size: 1.8rem; color: var(--success-color); }
.success-message small { font-size: 1rem; color: var(--text-color); opacity: 0.8; }
.success-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1rem; }
.next-btn, .restart-btn { padding: 0.8rem 1.5rem; font-size: 1rem; cursor: pointer; border: none; border-radius: 8px; font-weight: bold; }
.next-btn { background-color: var(--success-color); color: white; }
.restart-btn { background-color: var(--button-bg); color: var(--text-color); border: 1px solid var(--button-border); }

/* --- Pop-up Stilleri --- */
.popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 100; }
.game-info-popup, .name-input-popup { background-color: var(--background-color); padding: 2rem; border-radius: 12px; border: 1px solid var(--button-border); width: 90%; max-width: 400px; position: relative; display: flex; flex-direction: column; gap: 1.5rem; }
.name-input-popup { gap: 1rem; text-align: center; }
.close-popup-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 2rem; color: var(--text-color); cursor: pointer; line-height: 1; }
.popup-players-list { list-style: none; padding: 0; margin: 0; }
.popup-players-list li { display: flex; justify-content: space-between; padding: 0.3rem 0; }
.player-score { font-weight: bold; }

/* --- Geçiş Ekranı Stilleri --- */
.transition-screen { background-color: var(--background-color); color: var(--text-color); }
.transition-screen h2 { color: var(--success-color); font-size: 2rem; }

/* --- Vue Transition Stilleri --- */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

@media (min-width: 769px) {
  .game-container { flex-direction: row; justify-content: center; align-items: flex-start; gap: 2rem; max-width: 1200px; margin: 0 auto; }
  .word-display-section { flex: 1 1 60%; height: 100%; }
  .right-panel { flex: 1 1 40%; max-width: 400px; }
  .letter-circle-section { min-height: 400px; }
}
</style>
