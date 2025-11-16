#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { findAllTriplets, type Triplet } from './triplet-finder.js';
import { parseSRT } from './srt-parser.js';
import { isValidFirstTriplet } from './triplet-finder.js';
import { transformToKeyword } from './triplet-utils.js';

const OUTPUT_DIR = '/home/jk/jkbox/generated';

function formatTriplet(triplet: Triplet): string {
  return triplet.allEntries
    .map((entry) => {
      return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`;
    })
    .join('\n\n');
}

function formatTripletSequence(triplets: Triplet[]): string {
  return triplets.map(formatTriplet).join('\n\n---\n\n');
}

const program = new Command();

program
  .name('cinema-pippin')
  .description('Find triplet patterns in SRT subtitle files')
  .version('0.1.0')
  .argument('<srt-file>', 'Path to SRT subtitle file')
  .option('-v, --verbose', 'Show diagnostic information')
  .action((srtFile: string, options: { verbose?: boolean }) => {
    try {
      console.log(`Reading ${srtFile}...`);
      const content = readFileSync(srtFile, 'utf-8');

      const entries = parseSRT(content);
      console.log(`Parsed ${entries.length} SRT entries`);

      if (options.verbose) {
        console.log('\nChecking for valid first triplets...');
        let validFirstCount = 0;
        for (let i = 1; i < entries.length; i++) {
          // Try 0, 1, 2 fillers
          for (let fillers = 0; fillers <= 2; fillers++) {
            const frame2Idx = i + 1 + fillers;
            const frame3Idx = frame2Idx + 1;
            if (frame3Idx >= entries.length) break;

            if (isValidFirstTriplet(entries, i, frame2Idx, frame3Idx)) {
              validFirstCount++;
              const keyword = transformToKeyword(entries[frame3Idx].text);
              console.log(`  Found valid first triplet at index ${i} with ${fillers} filler(s) (frames ${entries[i].index}, ${entries[frame2Idx].index}, ${entries[frame3Idx].index}), keyword: "${keyword}"`);
              if (validFirstCount >= 5) {
                console.log(`  ... (showing first 5 only)`);
                break;
              }
            }
          }
          if (validFirstCount >= 5) break;
        }
        console.log(`Total valid first triplets: ${validFirstCount}`);
      }

      console.log('\nFinding triplet sequences (3 triplets each)...');
      const tripletSequences = findAllTriplets(content);

      console.log(`Found ${tripletSequences.length} complete triplet sequence(s)`);

      if (tripletSequences.length === 0) {
        console.log('\nNo valid triplet sequences found.');
        if (!options.verbose) {
          console.log('Run with --verbose to see diagnostic information');
        }
        return;
      }

      const baseFilename = basename(srtFile);

      tripletSequences.forEach((sequence, index) => {
        const outputFilename = join(OUTPUT_DIR, `${baseFilename}.${index + 1}.txt`);
        const outputContent = formatTripletSequence(sequence);

        writeFileSync(outputFilename, outputContent, 'utf-8');
        console.log(`Wrote ${outputFilename}`);
      });

      console.log('\nDone!');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Unknown error occurred');
      }
      process.exit(1);
    }
  });

program.parse();
