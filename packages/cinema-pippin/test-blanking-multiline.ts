#!/usr/bin/env tsx

import { condenseAndBlank } from './src/blanking-utils.js';
import { blankWithSpaces } from './src/blanking-utils.js';

// Test 1: Single-line text (what we just tested)
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 1: Single-line text');
console.log('═══════════════════════════════════════════════════════════');
const textLinesSingle = ["I'd like to talk to you before you leave. Will you come over one evening?"];
const blankedSingle = condenseAndBlank(textLinesSingle);
console.log('Input lines:', textLinesSingle);
console.log('Blanked:', blankedSingle);
console.log('Word count:', blankedSingle.split(/\s+/).length);
console.log('');

// Test 2: What if it was MULTI-LINE in the original SRT?
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 2: Multi-line text (condenseAndBlank)');
console.log('═══════════════════════════════════════════════════════════');
const textLinesMulti = [
  "I'd like to talk to you before you leave.",
  "Will you come over one evening?"
];
const blankedMulti = condenseAndBlank(textLinesMulti);
console.log('Input lines:', textLinesMulti);
console.log('Blanked:', blankedMulti);
console.log('Word count:', blankedMulti.split(/\s+/).length);
console.log('');

// Test 3: What if OLD CODE was used (blankWithSpaces on each line separately)?
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 3: OLD BUGGY CODE - blank each line separately');
console.log('═══════════════════════════════════════════════════════════');
const oldBuggyResult = textLinesSingle.map(line => blankWithSpaces(line)).join('\n');
console.log('Input lines:', textLinesSingle);
console.log('Blanked (OLD WAY):', oldBuggyResult);
console.log('Word count:', oldBuggyResult.split(/\s+/).length);
console.log('');

// Test 4: What if it was firstLineOnly from OLD code?
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 4: OLD CODE - first line only');
console.log('═══════════════════════════════════════════════════════════');
const firstLineOnly = textLinesSingle.length > 1 ? textLinesSingle[0] : textLinesSingle.join('\n');
const oldCodeResult = blankWithSpaces(firstLineOnly);
console.log('First line only:', firstLineOnly);
console.log('Blanked (OLD CODE):', oldCodeResult);
console.log('Word count:', oldCodeResult.split(/\s+/).length);
