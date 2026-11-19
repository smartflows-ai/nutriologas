// src/lib/full-name.ts
// Rule for the patient's name on a new visit (ticket #113): a first name and a surname, typed by a person.
// Used by every way a visit is created (panel, /agendar, WhatsApp bot) and by the forms while the person types.
// Pure: no I/O, safe in the browser.

const MAX_FULL_NAME = 120;

/** Courtesy titles typed before a name ("Dra. Ana López"): skipped, they are not part of the name. */
const TITLES: ReadonlySet<string> = new Set([
  "dr", "dra", "sr", "sra", "srta", "lic", "licda", "ing", "mtro", "mtra", "prof", "profa", "don", "dona",
]);

/** Small words and suffixes inside a name ("María de la Luz", "Pérez Jr."): allowed, not counted as a name word. */
const PARTICLES: ReadonlySet<string> = new Set([
  "de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos", "van", "von", "der", "di", "du", "jr",
]);

/** Words that stand in for a missing name, or that are not a name at all. */
const FILLER: ReadonlySet<string> = new Set([
  "desconocido", "desconocida", "paciente", "cliente", "usuario", "usuaria", "nombre", "apellido", "test", "prueba",
  "anonimo", "anonima", "whatsapp", "null", "undefined", "xx", "xxx", "ok", "hola", "nose", "no", "si",
]);

/** Rows of the keyboard typed by hand instead of a name. */
const KEYBOARD_MASH: ReadonlySet<string> = new Set([
  "asd", "asdf", "asdfg", "qwe", "qwer", "qwert", "qwerty", "zxc", "zxcv", "jkl", "hjk", "sdf", "dfg", "fgh", "ghj",
]);

// Built with the RegExp constructor: the project targets ES5, where a /u regex literal is not allowed.
/** Letters of any alphabet, with an apostrophe or hyphen between them ("O'Connor", "Peña-Ortiz"). */
const WORD = new RegExp("^\\p{L}+(?:['\\u2019-]\\p{L}+)*$", "u");
/** An initial or a short abbreviation: "J.", "M", "Ma.". */
const INITIAL = new RegExp("^\\p{L}{1,2}\\.$|^\\p{L}$", "u");
const LATIN_ONLY = /^[a-z'’-]+$/;
const VOWEL = /[aeiouy]/;
const ONE_LETTER_REPEATED = /^(.)\1+$/;
/** Below this length a Latin word may have no vowel ("Ng"); longer ones need one ("Krt" is not a name). */
const MIN_LETTERS_FOR_VOWEL_CHECK = 3;

/** Lowercase, without accents: how two spellings of one word are compared. */
function plain(word: string): string {
  return word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function withoutTitles(words: string[]): string[] {
  let start = 0;
  while (start < words.length && TITLES.has(plain(words[start]).replace(/\.$/, ""))) start++;
  return words.slice(start);
}

function isNameWord(key: string): boolean {
  const letters = key.replace(/['’-]/g, "");
  if (letters.length < 2 || ONE_LETTER_REPEATED.test(letters) || KEYBOARD_MASH.has(letters) || FILLER.has(letters)) {
    return false;
  }
  const needsVowel = LATIN_ONLY.test(key) && letters.length >= MIN_LETTERS_FOR_VOWEL_CHECK;
  return !needsVowel || VOWEL.test(letters);
}

/** The words that count as a name (titles, particles and initials left out), or null when a word is not valid. */
function nameWords(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!text || text.length > MAX_FULL_NAME) return null;

  const counted: string[] = [];
  for (const word of withoutTitles(text.split(" "))) {
    const key = plain(word.replace(/\.$/, ""));
    if (PARTICLES.has(key) || INITIAL.test(word)) continue;
    if (!WORD.test(word) || !isNameWord(key)) return null;
    counted.push(key);
  }
  return counted;
}

/**
 * True when the text reads as a first name and a surname: at least two words of two letters or more (letters of
 * any alphabet, with an apostrophe or hyphen), a vowel in each longer Latin word, two words that are not the same
 * word, and no keyboard mash, repeated letter or filler such as "desconocido". Titles ("Dra.", "Mtra."), particles
 * ("de la", "Jr.") and initials ("Ma.", "J.") are allowed and do not count as a word.
 */
export function isPlausibleFullName(value: unknown): boolean {
  const words = nameWords(value);
  return words !== null && words.length >= 2 && new Set(words).size > 1;
}

/**
 * True when a stored name has no real first name ("Paciente", "Desconocido", empty): the #72 check cannot compare
 * it with the name the bot sends, so a patient registered that way can give their real name without being taken
 * for another person.
 */
export function isFillerName(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const first = withoutTitles(value.normalize("NFC").trim().split(/\s+/).filter(Boolean))[0];
  if (!first) return true;
  if (INITIAL.test(first)) return false;
  return !(WORD.test(first) && isNameWord(plain(first)));
}
