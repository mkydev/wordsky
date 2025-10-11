import { turkishWords } from '../data/turkishWords';

export function generateWords(baseWord: string, wordList: string[]): string[] {
  const letters = baseWord.split('');
  const subwords = new Set<string>(); // Kelimeler "Set" veri yapısında tutuluyor

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
    if (word.length >= 3 && canBeFormed(word, letters)) {
      subwords.add(word); // ".add()" metodu sayesinde aynı kelime tekrar eklenmez
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
 * @param count Seçilecek harf sayısı
 * @returns Rastgele seçilmiş harflerden oluşan bir string
 */
function getRandomLetters(count: number): string {
    const alphabet = 'abcçdefgğhıijklmnoöprsştuüvyz';
    let result = '';
    for (let i = 0; i < count; i++) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
}

// Örnek kullanım:
generateWordsWithRandomLetters();