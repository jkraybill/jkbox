#!/usr/bin/env tsx

import { condenseAndBlank } from './src/blanking-utils.js';

// Simulate the exact scenario from la-piscine T3 F3
const srtFrameText = `3
00:00:05,166 --> 00:00:08,165
I'd like to talk to you before you leave. Will you come over one evening?`;

console.log('Original SRT frame:');
console.log(srtFrameText);
console.log('');

// Split into lines (like the code does)
const lastFrameLines = srtFrameText.split('\n');
console.log('Frame lines:', lastFrameLines);
console.log('');

// Extract text lines (skip index and timestamp)
const textLines = lastFrameLines.slice(2);
console.log('Text lines to blank:', textLines);
console.log('');

// Call condenseAndBlank (this is what triplet-judger.ts does)
const blankedText = condenseAndBlank(textLines);
console.log('Blanked result:', blankedText);
console.log('Blank word count:', blankedText.split(/\s+/).length);
console.log('');

// Show what the reconstructed frame looks like
const blankedFrame = [
  lastFrameLines[0], // Index
  lastFrameLines[1], // Timestamp
  blankedText        // Blanked text
].join('\n');

console.log('Reconstructed blanked frame:');
console.log(blankedFrame);
