<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import LetterCircle from './components/LetterCircle.vue';
import WordDisplay from './components/WordDisplay.vue';

const API_BASE_URL = 'http://localhost:3000/api/v1';

const words = ref<string[]>([]);
const letters = ref<string[]>([]);
const difficulty = ref<4 | 5 | 6>(4);
const loading = ref(false);
const error = ref<string | null>(null);
const gameStarted = ref(false);

const foundWords = ref<string[]>([]);
const currentSelectedWord = ref<string>('');

async function createNewPuzzle(diff: 4 | 5 | 6) {
  difficulty.value = diff;
  loading.value = true;
  error.value = null;
  gameStarted.value = true;
  foundWords.value = [];
  try {
    const response = await fetch(`${API_BASE_URL}/puzzles/random?difficulty=${diff}`);
    if (!response.ok) {
      throw new Error('Bulmaca oluşturulurken bir hata oluştu.');
    }
    const data = await response.json();
    if (!data.words || data.words.length === 0) {
      throw new Error('Bu zorlukta uygun bir bulmaca bulunamadı, lütfen tekrar deneyin.');
    }
    words.value = data.words;
    letters.value = data.letters;
  } catch (e) {
    error.value = (e as Error).message;
    console.error('createNewPuzzle error:', e);
  } finally {
    loading.value = false;
  }
}

function goBackToDifficultySelection() {
  gameStarted.value = false;
  words.value = [];
  letters.value = [];
}

watch(currentSelectedWord, (newWord: string) => {
  if (newWord && words.value.includes(newWord) && !foundWords.value.includes(newWord)) {
    foundWords.value.push(newWord);
  }
});

const allWordsFound = computed(() => {
  return words.value.length > 0 && words.value.length === foundWords.value.length;
});

function shuffleLetters() {
  for (let i = letters.value.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters.value[i], letters.value[j]] = [letters.value[j]!, letters.value[i]!];
  }
}
</script>

<template>
  <main>
    <header>
      <h1>Word of YK</h1>
      <button v-if="gameStarted" @click="goBackToDifficultySelection" class="back-button">
        ← Zorluk Seçimi
      </button>
    </header>

    <div v-if="!gameStarted" class="level-selector">
      <div class="difficulty-selector">
        <h2>Zorluk Seviyesi Seçin</h2>
        <div class="difficulty-buttons">
          <button
            v-for="diff in [4, 5, 6]"
            :key="diff"
            @click="createNewPuzzle(diff as 4 | 5 | 6)"
            class="difficulty-btn"
          >
            {{ diff }} Harf
          </button>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="game-info">
        <span>{{ difficulty }} Harfli Bulmaca</span>
      </div>

      <div v-if="loading" class="loading">Yeni bulmaca oluşturuluyor...</div>
      <div v-if="error" class="error">{{ error }}</div>

      <template v-if="!loading && !error && words.length > 0">
          <div v-if="allWordsFound" class="success-message">
            <h2>Tebrikler! Tüm kelimeleri buldunuz!</h2>
            <div class="success-buttons">
              <button @click="createNewPuzzle(difficulty)" class="next-btn">
                Yeni Bulmaca
              </button>
              <button @click="goBackToDifficultySelection" class="restart-btn">Ana Menü</button>
            </div>
          </div>

          <template v-else>
            <div class="game-container">
              <div class="word-display-section">
                <WordDisplay :words="words" :found-words="foundWords" />
              </div>
              <div class="letter-circle-section">
                <LetterCircle :letters="letters" v-model:current-selected-word="currentSelectedWord" @shuffle="shuffleLetters" />
              </div>
            </div>
          </template>
      </template>
    </div>

  </main>
</template>

<style scoped>
main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: sans-serif;
  background-color: #2c3e50;
  color: white;
  box-sizing: border-box;
  padding: 0 1rem;
}

header {
  text-align: center;
  padding: 1rem 0;
  flex-shrink: 0;
  position: relative;
}

.back-button {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.level-selector {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.difficulty-selector {
  text-align: center;
}

.difficulty-selector h2 {
  color: #ecf0f1;
  margin-bottom: 2rem;
  font-size: clamp(1.2rem, 4vw, 1.8rem);
}

.difficulty-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.difficulty-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 1.5rem 2rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: bold;
  transition: all 0.3s ease;
  min-width: 140px;
}

.difficulty-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.game-info {
  text-align: center;
  padding: 1rem;
  background: rgba(66, 184, 131, 0.1);
  border-radius: 8px;
  margin: 0 1rem 1rem 1rem;
  color: #42b883;
  font-weight: bold;
}

.success-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.next-btn, .restart-btn {
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-weight: bold;
}

.next-btn {
  background-color: #42b883;
  color: white;
}

.next-btn:hover {
  background-color: #3aa876;
  transform: translateY(-1px);
}

.restart-btn {
  background-color: #34495e;
  color: white;
}

.restart-btn:hover {
  background-color: #2c3e50;
}

h1 {
  font-size: clamp(1.2rem, 5vw, 2rem);
  margin: 0;
  text-align: center;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: #e74c3c;
}

.game-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  justify-content: flex-start;
  max-width: 100%;
  gap: 1.5rem;
  padding: 0 1rem;
}

.word-display-section {
  flex: 0 1 auto;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
}

.letter-circle-section {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 250px;
}

.success-message {
  text-align: center;
  margin-bottom: 1rem;
}

.success-message h2 {
  font-size: 1.8rem;
  color: #42b883;
}

@media (max-width: 768px) {
  .difficulty-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
