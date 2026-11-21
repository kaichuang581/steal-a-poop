// Builds public/words-fr.txt, the French game's word list, from the MIT-licensed "an-array-of-french-words" package.
// Usage: npm pack an-array-of-french-words && tar xzf an-array-of-french-words-*.tgz
//        node scripts/build-french-words.mjs package/index.json
// Words are stored without accents (the game folds what is typed the same way), lowercase a-z only, so hyphenated and
// apostrophe forms are dropped. French swear words and slurs are taken out here; createDictionary also drops anything
// the English profanity list catches.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/build-french-words.mjs <index.json>');

// Exact words refused, and stems refused at the start of a word (with their inflections).
const BANNED = new Set([
  'con', 'cons', 'conne', 'connes', 'merde', 'merdes', 'merdique', 'merdiques', 'merdeux', 'merdeuse', 'merdeuses',
  'bite', 'bites', 'chatte', 'chattes', 'cul', 'culs', 'pute', 'putes', 'putain', 'putains', 'pd', 'nique', 'niquer',
  'chier', 'chie', 'chies', 'chiant', 'chiante', 'chiants', 'chiantes', 'couille', 'couilles', 'foutre', 'bordel',
  'bordels', 'zob', 'zobs', 'teub', 'nichon', 'nichons', 'branler', 'bougnoule', 'negre', 'negres', 'negresse',
  'youpin', 'youpins', 'bamboula', 'gouine', 'gouines', 'tapette', 'tapettes', 'tarlouze', 'enfoire', 'enfoires',
  'salaud', 'salauds', 'batard', 'batards', 'batarde', 'batardes', 'baiser', 'baise', 'baises', 'sexe', 'sexes',
  'porno', 'pornos', 'pornographie', 'pornographique', 'viol', 'viols', 'violer', 'nazi', 'nazis',
]);
const STEMS = ['connard', 'connass', 'encul', 'salop', 'putass', 'niqu', 'branl', 'bougnoul', 'pedale', 'pede', 'emmerd', 'chiott', 'foutr', 'baisai', 'baisa', 'baiseu'];

const fold = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
const out = new Set();
for (const raw of JSON.parse(readFileSync(src, 'utf8'))) {
  const w = fold(String(raw).trim().toLowerCase());
  if (!/^[a-z]+$/.test(w) || w.length < 2) continue;
  if (BANNED.has(w) || STEMS.some((s) => w.startsWith(s))) continue;
  out.add(w);
}
writeFileSync('public/words-fr.txt', [...out].sort().join('\n') + '\n');
console.log(`public/words-fr.txt: ${out.size} words`);
