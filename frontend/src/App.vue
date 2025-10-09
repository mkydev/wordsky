<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import LetterCircle from './components/LetterCircle.vue';
import WordDisplay from './components/WordDisplay.vue';

const words = ref<string[]>([]);
const letters = ref<string[]>([]);
const difficulty = ref<4 | 5 | 6>(4); // Zorluk seviyesi (harf sayısı)
const currentLevel = ref(1); // Seçili level
const loading = ref(true);
const error = ref<string | null>(null);
const showLevelSelector = ref(true);

// Level bilgileri
const availableLevels = ref<{ [key: string]: number }>({});
const levelDetails = ref<any[]>([]);

const foundWords = ref<string[]>([]);
const currentSelectedWord = ref<string>('');

// Tüm level bilgilerini getir
async function fetchAvailableLevels() {
  try {
    const response = await fetch('http://localhost:3000/api/v1/levels/info');
    if (!response.ok) throw new Error('Failed to fetch level info');
    const data = await response.json();
    availableLevels.value = data.availableLevels;
  } catch (e) {
    console.error('Error fetching available levels:', e);
  }
}

// Zorluk seviyesine göre level detaylarını getir
async function fetchLevelDetails(diff: 4 | 5 | 6) {
  try {
    const response = await fetch(`http://localhost:3000/api/v1/levels/difficulty/${diff}`);
    if (!response.ok) throw new Error('Failed to fetch level details');
    const data = await response.json();
    levelDetails.value = data.levels;
  } catch (e) {
    console.error('Error fetching level details:', e);
    levelDetails.value = [];
  }
}

// Oyun verisini getir
async function fetchLevelData() {
  if (showLevelSelector.value) return;
  
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`http://localhost:3000/api/v1/levels/difficulty/${difficulty.value}/level/${currentLevel.value}`);
    if (!response.ok) {
      throw new Error('Failed to fetch level data');
    }
    const data = await response.json();
    words.value = data.words;
    letters.value = data.letters;
  } catch (e) {
    error.value = (e as Error).message;
    console.error('fetchLevelData: error', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchAvailableLevels();
  // İlk açılışta 4 harfli levelleri göster
  fetchLevelDetails(4);
});

// Zorluk seviyesi değiştiğinde level detaylarını getir
watch(difficulty, (newDiff) => {
  fetchLevelDetails(newDiff);
  currentLevel.value = 1; // Level'ı reset et
});

// Level seçimi fonksiyonları
function selectDifficulty(diff: 4 | 5 | 6) {
  difficulty.value = diff;
  fetchLevelDetails(diff);
}

function selectLevel(level: number) {
  currentLevel.value = level;
  showLevelSelector.value = false;
  foundWords.value = []; // Bulunan kelimeleri reset et
  fetchLevelData();
}

function goBackToLevelSelector() {
  showLevelSelector.value = true;
  foundWords.value = [];
  words.value = [];
  letters.value = [];
}

watch(currentSelectedWord, (newWord) => {
  if (newWord && words.value.includes(newWord) && !foundWords.value.includes(newWord)) {
    foundWords.value.push(newWord);
  }
});

const allWordsFound = computed(() => {
  return words.value.length > 0 && words.value.length === foundWords.value.length;
});

function restartGame() {
  foundWords.value = [];
  fetchLevelData();
}

function nextLevel() {
  const maxLevels = availableLevels.value[difficulty.value.toString()] || 1;
  if (currentLevel.value < maxLevels) {
    currentLevel.value++;
    foundWords.value = [];
    fetchLevelData();
  } else {
    // Son level'daysa level seçicisine dön
    goBackToLevelSelector();
  }
}

function shuffleLetters() {
    for (let i = letters.value.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = letters.value[i];
        if (temp !== undefined && letters.value[j] !== undefined) {
            [letters.value[i], letters.value[j]] = [letters.value[j]!, letters.value[i]!];
        }
    }
}

</script>

<template>
  <main>
    <header>
      <h1>Word of YK</h1>
      <button v-if="!showLevelSelector" @click="goBackToLevelSelector" class="back-button">
        ← Level Seçimi
      </button>
    </header>

    <!-- Level Seçici -->
    <div v-if="showLevelSelector" class="level-selector">
      <!-- Zorluk Seviyesi Seçimi -->
      <div class="difficulty-selector">
        <h2>Zorluk Seviyesi Seçin</h2>
        <div class="difficulty-buttons">
          <button 
            v-for="diff in [4, 5, 6]" 
            :key="diff"
            @click="selectDifficulty(diff as 4 | 5 | 6)"
            :class="{ active: difficulty === diff }"
            class="difficulty-btn"
          >
            {{ diff }} Harf
            <span class="level-count">{{ availableLevels[diff] || 0 }} Level</span>
          </button>
        </div>
      </div>

      <!-- Level Seçimi -->
      <div v-if="levelDetails.length > 0" class="level-grid">
        <h3>{{ difficulty }} Harfli Levellar</h3>
        <div class="level-buttons">
          <button
            v-for="level in levelDetails"
            :key="level.level"
            @click="selectLevel(level.level)"
            class="level-btn"
          >
            <div class="level-number">{{ level.level }}</div>
            <div class="level-info">
              <span>{{ level.wordCount }} kelime</span>
              <span>{{ level.letterCount }} harf</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Oyun Ekranı -->
    <div v-if="!showLevelSelector">
      <div class="game-info">
        <span>{{ difficulty }} Harf - Level {{ currentLevel }}</span>
      </div>

      <div v-if="loading" class="loading">Loading...</div>
      <div v-if="error" class="error">{{ error }}</div>

      <template v-if="!loading && !error">
          <div v-if="allWordsFound" class="success-message">
            <h2>Tebrikler! Tüm kelimeleri buldunuz!</h2>
            <div class="success-buttons">
              <button @click="nextLevel" class="next-btn">
                {{ currentLevel < (availableLevels[difficulty.toString()] || 1) ? 'Sonraki Level' : 'Level Seçimi' }}
              </button>
              <button @click="restartGame" class="restart-btn">Tekrar Oyna</button>
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

/* Level Selector Styles */
.level-selector {
  flex: 1;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.difficulty-selector {
  text-align: center;
  margin-bottom: 3rem;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.difficulty-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.difficulty-btn.active {
  background: #42b883;
  border-color: #42b883;
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.4);
}

.level-count {
  font-size: 0.8rem;
  opacity: 0.8;
  font-weight: normal;
}

.level-grid {
  text-align: center;
}

.level-grid h3 {
  color: #42b883;
  margin-bottom: 2rem;
  font-size: clamp(1rem, 3vw, 1.4rem);
}

.level-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.level-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 1.5rem 1rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.level-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  border-color: #42b883;
}

.level-number {
  font-size: 1.8rem;
  font-weight: bold;
  color: #42b883;
}

.level-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.8rem;
  opacity: 0.8;
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

.success-message button {
  margin-top: 1rem;
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  background-color: #42b883;
  color: white;
  border-radius: 5px;
  transition: background-color 0.3s;
}

.success-message button:hover {
  background-color: #3aa876;
}

@media (max-width: 768px) {
  .level-selector {
    padding: 1rem;
  }
  
  .difficulty-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .difficulty-btn {
    min-width: 200px;
    padding: 1.2rem 1.5rem;
  }
  
  .level-buttons {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.8rem;
  }
  
  .level-btn {
    padding: 1.2rem 0.8rem;
  }
  
  .level-number {
    font-size: 1.5rem;
  }
  
  .back-button {
    left: 0.5rem;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}

@media (max-width: 600px) {
  main {
    padding: 0 0.5rem;
  }
  
  header {
    padding: 0.5rem 0;
  }
  
  h1 {
    font-size: 1.4rem;
  }
  
  .game-container {
    gap: 1rem;
    padding: 0 0.5rem;
  }
  
  .word-display-section {
    min-height: 100px;
  }
  
  .letter-circle-section {
    min-height: 220px;
  }
  
  .success-message h2 {
    font-size: 1.2rem;
  }
  
  .success-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .next-btn, .restart-btn {
    width: 200px;
  }
  
  .level-selector {
    padding: 0.5rem;
  }
  
  .difficulty-selector h2 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }
  
  .difficulty-btn {
    min-width: 100%;
    max-width: 250px;
  }
}

@media (max-width: 480px) {
  main {
    padding: 0 0.25rem;
  }
  
  header {
    padding: 0.25rem 0;
  }
  
  h1 {
    font-size: 1.2rem;
  }
  
  .game-container {
    gap: 0.75rem;
    padding: 0 0.25rem;
  }
  
  .word-display-section {
    min-height: 80px;
  }
  
  .letter-circle-section {
    min-height: 200px;
  }
  
  .back-button {
    left: 0.25rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .game-container {
    flex-direction: row;
    align-items: stretch;
    gap: 1rem;
  }
  
  .word-display-section {
    flex: 0 1 35%;
    width: auto;
    min-height: auto;
  }
  
  .letter-circle-section {
    flex: 1;
    width: auto;
    min-height: auto;
  }
  
  header {
    padding: 0.25rem 0;
  }
  
  .level-selector {
    padding: 1rem;
  }
  
  .difficulty-buttons {
    flex-direction: row;
  }
}
</style>
