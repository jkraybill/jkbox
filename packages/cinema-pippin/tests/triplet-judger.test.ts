import { describe, it, expect, vi, beforeEach } from 'vitest';
import { judgeTriplet } from '../src/triplet-judger.js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Track Claude call count for all mocks (generation + judging)
let claudeCallCount = 0;

// Mock Anthropic SDK for all Claude calls (generation + judging)
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = function() {
    return {
      messages: {
        create: async (params: any) => {
          claudeCallCount++;
          const prompt = params.messages[0].content;

          // Parse constraints from prompt (for generation calls)
          // Look for numbered constraints that contain " -- " (e.g., "1. Foodie -- this punchline...")
          // This distinguishes actual constraints from numbered instructions in the prompt
          const constraintMatches = prompt.match(/^\d+\.\s+.+\s--\s.+$/gm) || [];
          const constraints = constraintMatches.map((line: string) => line.replace(/^\d+\.\s*/, '').trim());

          // Mock usage data for cost tracking
          const mockUsage = { input_tokens: 1000, output_tokens: 100 };

          // T1 word generation (call 1)
          if (claudeCallCount === 1) {
            const mockCouplets = constraints.slice(0, 6).map((constraint: string, idx: number) => {
              const words = ['sexophone', 'convertible', 'boobies', 'avocado', 'puppy', 'tacos'];
              return [constraint, words[idx]];
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(mockCouplets) }],
              usage: mockUsage
            };
          }

          // T1 word judging (call 2) - returns top 3 indices
          if (claudeCallCount === 2) {
            return {
              content: [{ type: 'text', text: '3 1 5' }], // Top 3: boobies, sexophone, puppy
              usage: mockUsage
            };
          }

          // T2 phrase generation (call 3)
          if (claudeCallCount === 3) {
            const mockCouplets = constraints.slice(0, 6).map((constraint: string, idx: number) => {
              const phrases = [
                'very sexy saxophone!',
                'driving a red convertible.',
                'showing off my boobies!',
                'eating fresh avocado toast.',
                'playing with my puppy.',
                'munching delicious tacos!'
              ];
              return [constraint, phrases[idx]];
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(mockCouplets) }],
              usage: mockUsage
            };
          }

          // T2 phrase judging (call 4) - returns top 3 indices
          if (claudeCallCount === 4) {
            return {
              content: [{ type: 'text', text: '2 4 1' }], // Top 3: convertible, avocado toast, sexy saxophone
              usage: mockUsage
            };
          }

          // T3 phrase generation (call 5)
          if (claudeCallCount === 5) {
            const mockCouplets = constraints.slice(0, 6).map((constraint: string, idx: number) => {
              const phrases = [
                'super sexy scenario!',
                'amazing automobile adventure.',
                'bouncing boobies bonanza!',
                'radical racing rivals?',
                'perfect puppy playtime.',
                'tasty taco time!'
              ];
              return [constraint, phrases[idx]];
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(mockCouplets) }],
              usage: mockUsage
            };
          }

          // T3 phrase judging (call 6) - returns top 3 indices
          if (claudeCallCount === 6) {
            return {
              content: [{ type: 'text', text: '4 2 5' }], // Top 3: racing rivals, automobile adventure, puppy playtime
              usage: mockUsage
            };
          }

          // Quality judging (call 7)
          if (claudeCallCount === 7) {
            const mockQualityAnswers = [
              ['1. Is scene 1 funny?', true],
              ['2. Is scene 2 funny?', true],
              ['3. Is scene 3 funny?', true],
              ['4. Is scene 1 coherent?', true],
              ['5. Is scene 2 coherent?', true],
              ['6. Is scene 3 coherent?', false],
              ['7. Do these three scenes tell a coherent story together?', true],
              ['8. Would these three scenes each make a spectator laugh out loud?', true],
              ['9. Are these scenes unexpected in a funny or ironic way?', true],
              ['10. Do these three scenes all embody best screenwriting practices?', false]
            ];
            return {
              content: [{ type: 'text', text: JSON.stringify(mockQualityAnswers) }],
              usage: mockUsage
            };
          }

          throw new Error(`Unexpected Claude call #${claudeCallCount}`);
        }
      }
    };
  };
  return { default: MockAnthropic };
});

// Mock fs.readFileSync to control constraints
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn((path: string, encoding?: string) => {
      // If reading constraints.txt, return fixed test constraints (using single quotes like the real file)
      if (path.includes('constraints.txt')) {
        return `The letter 'S' -- this punchline must begin with the letter 'S'.
Cars -- this punchline should refer to car-related topics.
Nudity -- this punchline should be about nudity, body part euphemisms, boobies, peepees, butts, bums, nips, etc, while being max funny.
The letter 'A' -- this punchline must begin with the letter 'A'.
Pippin's word -- this punchline should be dog-related, invoking the energy of Pippin, our mischevious moodle puppy and game host.
Foodie -- this punchline should be food-related.`;
      }
      // For other files, use actual implementation
      return actual.readFileSync(path, encoding as BufferEncoding);
    }),
  };
});

describe('Triplet Judger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claudeCallCount = 0; // Reset Claude call counter
  });

  describe('judgeTriplet', () => {
    it('should parse first scene and extract keyword', async () => {
      // Create a mock triplet file
      const testDir = '/tmp/triplet-test';
      mkdirSync(testDir, { recursive: true });

      const tripletContent = `1
00:00:00,000 --> 00:00:02,000
I love bananas.

2
00:00:02,000 --> 00:00:04,000
They are my favorite fruit.

---

3
00:00:04,000 --> 00:00:06,000
[keyword] are yellow.

4
00:00:06,500 --> 00:00:08,000
But I prefer apples.

---

5
00:00:08,000 --> 00:00:10,000
What do you think about fruit?

6
00:00:10,500 --> 00:00:12,000
Fruit is amazing!`;

      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, tripletContent, 'utf-8');

      // All Claude calls are now mocked via the @anthropic-ai/sdk mock above
      // 7 total calls: T1 gen, T1 judge, T2 gen, T2 judge, T3 gen, T3 judge, quality judge

      const result = await judgeTriplet(testFile, 1);

      // T1 (word) assertions
      expect(result.keyword).toBe('fruit'); // Last word of last frame
      expect(result.blankedScene).toContain('_____');
      expect(result.generatedWords).toHaveLength(6);
      expect(result.shuffledWords).toHaveLength(6);
      expect(result.bestWord).toBeDefined();
      expect(result.bestWordIndex).toBeGreaterThanOrEqual(0);
      expect(result.bestWordIndex).toBeLessThan(6);

      // T2 (phrase) assertions
      expect(result.secondScene).toBeDefined();
      expect(result.secondScene).toContain('[keyword]'); // Before replacement
      expect(result.secondSceneWithWord).toBeDefined();
      expect(result.secondSceneWithWord).toContain(result.bestWord); // After replacement with best word
      expect(result.secondSceneWithWord).not.toContain('[keyword]'); // [keyword] should be replaced
      expect(result.secondSceneWithWord).not.toContain('_____'); // Original text preserved (no blank yet)
      expect(result.generatedPhrases).toHaveLength(6);
      expect(result.shuffledPhrases).toHaveLength(6);
      expect(result.bestPhrase).toBeDefined();
      expect(result.bestPhraseIndex).toBeGreaterThanOrEqual(0);
      expect(result.bestPhraseIndex).toBeLessThan(6);

      // T3 (third scene) assertions
      expect(result.thirdScene).toBeDefined();
      expect(result.thirdScene).toContain('fruit'); // Original keyword present (case-insensitive)
      expect(result.thirdSceneWithWord).toBeDefined();
      expect(result.thirdSceneWithWord).toContain(result.bestWord); // Best word replaced
      expect(result.thirdSceneWithWord.toLowerCase()).not.toContain('fruit'); // Original keyword replaced (case-insensitive)
      expect(result.generatedPhrasesT3).toHaveLength(6);
      expect(result.shuffledPhrasesT3).toHaveLength(6);
      expect(result.bestPhraseT3).toBeDefined();
      expect(result.bestPhraseIndexT3).toBeGreaterThanOrEqual(0);
      expect(result.bestPhraseIndexT3).toBeLessThan(6);

      // Quality judging assertions
      expect(result.qualityAnswers).toHaveLength(10);
      expect(result.qualityScore).toBe(8); // Mock has 8 true answers
      expect(result.finalScene1).toBeDefined();
      expect(result.finalScene2).toBeDefined();
      expect(result.finalScene3).toBeDefined();
      expect(result.finalScene1).toContain(result.bestWord);
      expect(result.finalScene2).toContain(result.bestPhrase);
      expect(result.finalScene3).toContain(result.bestPhraseT3);
    });

    it.skip('should handle Claude API errors gracefully with retries', async () => {
      // This test would need to mock the Anthropic SDK to throw errors
      // Skipped for now - the retry logic is tested elsewhere
    });
  });
});
