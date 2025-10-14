import { turkishWords } from '../data/turkishWords';

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

export function generateWords(baseWord: string, wordList: string[]): string[] {
  const letters = baseWord.split('');
  const subwords = new Set<string>();

  function canBeFormed(word: string, availableLetters: string[]): boolean {
    const wordLetters = word.split('');
    const available = [...availableLetters];
    for (const letter of wordLetters) {
      const index = available.indexOf(letter);
      if (index === -1) {
        return false;
      }
      available.splice(index, 1);
    }
    return true;
  }

  for (const word of wordList) {
    // Kelime 3+ harf, temel harflerden oluşabilir ve yanyana sesli harf içermemeli
    if (word.length >= 3 && canBeFormed(word, letters) && !hasConsecutiveVowels(word)) {
      subwords.add(word);
    }
  }

  const subwordsArray = Array.from(subwords);

  // Bir kelimenin başka bir kelimenin içinde geçmesini engelle
  const filteredWords = subwordsArray.filter(word => {
    return !subwordsArray.some(otherWord => otherWord.includes(word) && otherWord !== word);
  });

  return filteredWords;
}

/**
 * Rastgele harflerle kelimeler üretir.
 */
export function generateWordsWithRandomLetters(): void {
    const randomLetters = getRandomLetters(4);
    console.log(`Rastgele seçilen harfler: ${randomLetters}`);

    // turkishWords objesindeki tüm kelimeleri tek bir diziye aktar
    const allWords = Object.values(turkishWords).flat() as string[];

    const generated_words = generateWords(randomLetters, allWords);
    console.log("Oluşturulan kelimeler:", generated_words);
}

/**
 * Belirtilen sayıda rastgele harf seçer.
 * Türkçede en sık kullanılan harfler: A, E, İ, N, R, L, K, M, D, T
 * @param count Seçilecek harf sayısı
 * @returns Rastgele seçilmiş harflerden oluşan bir string
 */
function getRandomLetters(count: number): string {
    // Türkçe alfabesi (özel karakterler dahil)
    const alphabet = 'abcçdefgğhıijklmnoöprsştuüvyz';
    let result = '';
    for (let i = 0; i < count; i++) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
}

// Örnek kullanım:
generateWordsWithRandomLetters();