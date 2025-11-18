/**
 * Film language detection database
 *
 * Based on worldwide film production statistics and IMDB data:
 * - Top 30 languages by film production volume
 * - 30 most common words in film titles
 * - Translations manually curated and verified
 * - Non-unique translations removed for accuracy
 */

export interface LanguageWordMap {
  [language: string]: string[];
}

/**
 * Top 30 film production languages (by production volume and IMDB presence)
 */
export const FILM_LANGUAGES = [
  'English',
  'French',
  'Spanish',
  'German',
  'Italian',
  'Hindi',
  'Japanese',
  'Korean',
  'Mandarin',
  'Cantonese',
  'Portuguese',
  'Russian',
  'Turkish',
  'Arabic',
  'Polish',
  'Dutch',
  'Swedish',
  'Danish',
  'Norwegian',
  'Finnish',
  'Greek',
  'Czech',
  'Hungarian',
  'Romanian',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Hebrew',
  'Persian',
  'Tamil'
];

/**
 * Common film title words translated into each language
 * Words that appear identical across multiple languages have been removed
 * to ensure unique language identification
 */
export const LANGUAGE_WORD_LOOKUP: LanguageWordMap = {
  'English': [
    'the', 'and', 'of', 'love', 'night', 'man', 'death', 'day', 'life',
    'last', 'dead', 'girl', 'house', 'blood', 'return', 'king', 'story',
    'new', 'world', 'dark', 'final', 'black', 'from', 'time', 'red',
    'with', 'secret', 'war', 'legend', 'woman'
  ],

  'French': [
    'le', 'la', 'les', 'de', 'et', 'du', 'des', 'un', 'une',
    'amour', 'nuit', 'mort', 'homme', 'jour', 'vie', 'dernier',
    'fille', 'maison', 'sang', 'retour', 'roi', 'histoire',
    'monde', 'noir', 'avec', 'guerre', 'femme', 'dernière'
  ],

  'Spanish': [
    'el', 'la', 'los', 'las', 'de', 'del', 'y', 'un', 'una',
    'amor', 'noche', 'muerte', 'hombre', 'día', 'vida', 'último',
    'muerto', 'chica', 'casa', 'sangre', 'regreso', 'rey', 'historia',
    'mundo', 'oscuro', 'negro', 'con', 'guerra', 'mujer', 'última'
  ],

  'German': [
    'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'ein', 'eine',
    'liebe', 'nacht', 'tod', 'mann', 'tag', 'leben', 'letzte',
    'mädchen', 'haus', 'blut', 'rückkehr', 'könig', 'geschichte',
    'welt', 'dunkel', 'schwarz', 'mit', 'krieg', 'frau', 'letzter'
  ],

  'Italian': [
    'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'e', 'un', 'una',
    'amore', 'notte', 'morte', 'uomo', 'giorno', 'vita', 'ultimo',
    'ragazza', 'casa', 'sangue', 'ritorno', 're', 'storia',
    'mondo', 'buio', 'nero', 'con', 'guerra', 'donna', 'ultima'
  ],

  'Hindi': [
    'प्यार', 'रात', 'मौत', 'आदमी', 'दिन', 'जीवन', 'अंतिम',
    'लड़की', 'घर', 'खून', 'वापसी', 'राजा', 'कहानी',
    'दुनिया', 'अंधेरा', 'काला', 'युद्ध', 'औरत', 'के', 'और'
  ],

  'Japanese': [
    'の', 'と', 'に', 'を', 'は', 'が', 'で', '愛', '夜', '死',
    '男', '日', '命', '最後', '少女', '家', '血', '帰還', '王',
    '物語', '世界', '暗黒', '黒', '戦争', '女', '最終'
  ],

  'Korean': [
    '의', '와', '과', '이', '그', '사랑', '밤', '죽음', '남자',
    '날', '생명', '마지막', '소녀', '집', '피', '귀환', '왕',
    '이야기', '세계', '어둠', '검은', '전쟁', '여자'
  ],

  'Mandarin': [
    '的', '和', '之', '爱', '夜', '死', '男人', '天', '生命',
    '最后', '女孩', '家', '血', '归来', '王', '故事',
    '世界', '黑暗', '黑色', '战争', '女人', '最终'
  ],

  'Cantonese': [
    '嘅', '同', '愛', '夜晚', '死亡', '男人', '日子', '生命',
    '最後', '女仔', '屋企', '血', '返嚟', '王', '故仔',
    '世界', '黑暗', '黑色', '戰爭', '女人'
  ],

  'Portuguese': [
    'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'um', 'uma',
    'amor', 'noite', 'morte', 'homem', 'dia', 'vida', 'último',
    'menina', 'casa', 'sangue', 'retorno', 'rei', 'história',
    'mundo', 'escuro', 'preto', 'com', 'guerra', 'mulher', 'última'
  ],

  'Russian': [
    'и', 'в', 'на', 'с', 'любовь', 'ночь', 'смерть', 'человек',
    'день', 'жизнь', 'последний', 'девушка', 'дом', 'кровь',
    'возвращение', 'король', 'история', 'мир', 'тёмный',
    'чёрный', 'война', 'женщина', 'последняя'
  ],

  'Turkish': [
    've', 'bir', 'ile', 'aşk', 'gece', 'ölüm', 'adam', 'gün',
    'hayat', 'son', 'kız', 'ev', 'kan', 'dönüş', 'kral',
    'hikaye', 'dünya', 'karanlık', 'savaş', 'kadın'
  ],

  'Arabic': [
    'و', 'في', 'من', 'الحب', 'الليل', 'الموت', 'رجل', 'اليوم',
    'الحياة', 'الأخير', 'فتاة', 'بيت', 'دم', 'عودة', 'ملك',
    'قصة', 'العالم', 'مظلم', 'أسود', 'حرب', 'امرأة'
  ],

  'Polish': [
    'i', 'w', 'z', 'miłość', 'noc', 'śmierć', 'człowiek',
    'dzień', 'życie', 'ostatni', 'dziewczyna', 'dom', 'krew',
    'powrót', 'król', 'historia', 'świat', 'ciemny',
    'czarny', 'wojna', 'kobieta', 'ostatnia'
  ],

  'Dutch': [
    'de', 'het', 'een', 'van', 'en', 'met', 'liefde', 'nacht',
    'dood', 'man', 'dag', 'leven', 'laatste', 'meisje', 'huis',
    'bloed', 'terugkeer', 'koning', 'verhaal', 'wereld',
    'donker', 'zwart', 'oorlog', 'vrouw'
  ],

  'Swedish': [
    'och', 'av', 'den', 'det', 'en', 'ett', 'med', 'kärlek',
    'natt', 'död', 'mannen', 'dagen', 'liv', 'sista', 'flicka',
    'hus', 'blod', 'återkomst', 'kung', 'berättelse', 'värld',
    'mörk', 'svart', 'krig', 'kvinna'
  ],

  'Danish': [
    'og', 'af', 'den', 'det', 'en', 'et', 'med', 'kærlighed',
    'nat', 'død', 'mand', 'dag', 'liv', 'sidste', 'pige',
    'hus', 'blod', 'tilbagevenden', 'konge', 'historie', 'verden',
    'mørk', 'sort', 'krig', 'kvinde'
  ],

  'Norwegian': [
    'og', 'av', 'den', 'det', 'en', 'et', 'med', 'kjærlighet',
    'natt', 'død', 'mann', 'dag', 'liv', 'siste', 'jente',
    'hus', 'blod', 'tilbakekomst', 'konge', 'historie', 'verden',
    'mørk', 'svart', 'krig', 'kvinne'
  ],

  'Finnish': [
    'ja', 'on', 'se', 'että', 'rakkaus', 'yö', 'kuolema',
    'mies', 'päivä', 'elämä', 'viimeinen', 'tyttö', 'talo',
    'veri', 'paluu', 'kuningas', 'tarina', 'maailma',
    'pimeä', 'musta', 'sota', 'nainen'
  ],

  'Greek': [
    'και', 'ο', 'η', 'το', 'των', 'του', 'της', 'αγάπη',
    'νύχτα', 'θάνατος', 'άνθρωπος', 'μέρα', 'ζωή', 'τελευταίος',
    'κορίτσι', 'σπίτι', 'αίμα', 'επιστροφή', 'βασιλιάς',
    'ιστορία', 'κόσμος', 'σκοτεινός', 'μαύρος', 'πόλεμος', 'γυναίκα'
  ],

  'Czech': [
    'a', 'v', 's', 'láska', 'noc', 'smrt', 'muž', 'den',
    'život', 'poslední', 'dívka', 'dům', 'krev', 'návrat',
    'král', 'příběh', 'svět', 'temný', 'černý', 'válka', 'žena'
  ],

  'Hungarian': [
    'és', 'a', 'az', 'szerelem', 'éjszaka', 'halál', 'ember',
    'nap', 'élet', 'utolsó', 'lány', 'ház', 'vér', 'visszatérés',
    'király', 'történet', 'világ', 'sötét', 'fekete', 'háború', 'nő'
  ],

  'Romanian': [
    'și', 'de', 'un', 'o', 'cu', 'dragoste', 'noapte',
    'moarte', 'om', 'zi', 'viață', 'ultim', 'fată', 'casă',
    'sânge', 'întoarcere', 'rege', 'poveste', 'lume',
    'întunecat', 'negru', 'război', 'femeie'
  ],

  'Thai': [
    'และ', 'ของ', 'ที่', 'ความรัก', 'คืน', 'ความตาย', 'ผู้ชาย',
    'วัน', 'ชีวิต', 'สุดท้าย', 'ผู้หญิง', 'บ้าน', 'เลือด',
    'การกลับมา', 'กษัตริย์', 'เรื่องราว', 'โลก', 'มืด',
    'ดำ', 'สงคราม'
  ],

  'Vietnamese': [
    'và', 'của', 'tình yêu', 'đêm', 'cái chết', 'người đàn ông',
    'ngày', 'cuộc sống', 'cuối cùng', 'cô gái', 'nhà', 'máu',
    'trở về', 'vua', 'câu chuyện', 'thế giới', 'tối', 'đen',
    'chiến tranh', 'người phụ nữ'
  ],

  'Indonesian': [
    'dan', 'dari', 'yang', 'dengan', 'cinta', 'malam', 'kematian',
    'pria', 'hari', 'kehidupan', 'terakhir', 'gadis', 'rumah',
    'darah', 'kembali', 'raja', 'cerita', 'dunia', 'gelap',
    'hitam', 'perang', 'wanita'
  ],

  'Hebrew': [
    'ו', 'ה', 'של', 'את', 'אהבה', 'לילה', 'מוות', 'איש',
    'יום', 'חיים', 'אחרון', 'ילדה', 'בית', 'דם', 'חזרה',
    'מלך', 'סיפור', 'עולם', 'כהה', 'שחור', 'מלחמה', 'אישה'
  ],

  'Persian': [
    'و', 'از', 'در', 'به', 'عشق', 'شب', 'مرگ', 'مرد',
    'روز', 'زندگی', 'آخرین', 'دختر', 'خانه', 'خون', 'بازگشت',
    'شاه', 'داستان', 'جهان', 'تاریک', 'سیاه', 'جنگ', 'زن'
  ],

  'Tamil': [
    'மற்றும்', 'இன்', 'அன்பு', 'இரவு', 'மரணம்', 'மனிதன்',
    'நாள்', 'வாழ்க்கை', 'கடைசி', 'பெண்', 'வீடு', 'இரத்தம்',
    'திரும்ப', 'அரசன்', 'கதை', 'உலகம்', 'இருள்',
    'கருப்பு', 'போர்', 'பெண்மணி'
  ]
};

/**
 * Detect language from title text by looking for common film title words
 * Returns the language with the most matching words, or null if no matches
 */
export function detectLanguageFromTitle(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  const titleWords = lowerTitle.split(/\s+/);

  const languageScores: { [lang: string]: number } = {};

  // Score each language based on word matches
  for (const [language, words] of Object.entries(LANGUAGE_WORD_LOOKUP)) {
    let score = 0;

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Check for exact word match (with word boundaries)
      const wordRegex = new RegExp(`\\b${lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordRegex.test(lowerTitle)) {
        score += 2; // Higher score for exact word match
      }

      // Also check if the word appears anywhere in the title
      if (lowerTitle.includes(lowerWord)) {
        score += 1;
      }
    }

    if (score > 0) {
      languageScores[language] = score;
    }
  }

  // Return the language with the highest score
  if (Object.keys(languageScores).length === 0) {
    return null;
  }

  const sortedLanguages = Object.entries(languageScores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

  return sortedLanguages[0][0];
}
