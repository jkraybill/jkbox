import { describe, it, expect, vi, beforeEach } from 'vitest';
import { judgeTriplet } from '../src/triplet-judger.js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Mock fetch for Ollama API
global.fetch = vi.fn();

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
Pippin's word -- this punchline should be dog-related, invoking the energy of Pippin, our mischevious moodle puppy and game host.`;
      }
      // For other files, use actual implementation
      return actual.readFileSync(path, encoding as BufferEncoding);
    }),
  };
});

describe('Triplet Judger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      // Mock Ollama responses with couplet format
      // The constraints are randomly selected in the actual code, so we need to intercept
      // the fetch call and dynamically create a response based on what was actually selected
      // Now we have 4 calls: T1 gen, T1 judge, T2 gen, T2 judge

      let mockResponseCount = 0;

      const mockResponse = (url: string, options: any) => {
        mockResponseCount++;

        const body = JSON.parse(options.body);
        const prompt = body.prompt;

        // First call is T1 generation (Prompt 1)
        if (mockResponseCount === 1) {
          // Parse constraints from prompt (they're listed as "1. constraint text")
          const constraintMatches = prompt.match(/📋 YOUR 5 CONSTRAINTS.*?\n([\s\S]*?)\n\n🎬 FILM SCENE/);
          const constraintLines = constraintMatches ? constraintMatches[1].split('\n') : [];
          const constraints = constraintLines.map((line: string) => line.replace(/^\d+\.\s*/, '').trim());

          // Create couplets with proper constraints (T1 words have NO punctuation now)
          const mockCouplets = constraints.slice(0, 5).map((constraint: string, idx: number) => {
            const words = ['sexophone', 'convertible', 'boobies', 'avocado', 'puppy'];
            return [constraint, words[idx]];
          });

          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: JSON.stringify(mockCouplets),
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Second call is T1 judging (Prompt 2)
        if (mockResponseCount === 2) {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: '3',
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Third call is T2 generation (Prompt 1 T2)
        if (mockResponseCount === 3) {
          // Parse constraints from T2 prompt (includes word counts)
          const constraintMatches = prompt.match(/📋 YOUR 5 CONSTRAINTS.*?\n([\s\S]*?)\n\n🎬 FILM SCENE/);
          const constraintLines = constraintMatches ? constraintMatches[1].split('\n') : [];
          const constraints = constraintLines.map((line: string) => line.replace(/^\d+\.\s*/, '').trim());

          // Create couplets with proper constraints (phrases this time)
          const mockCouplets = constraints.slice(0, 5).map((constraint: string, idx: number) => {
            const phrases = [
              'very sexy saxophone!',
              'driving a red convertible.',
              'showing off my boobies!',
              'eating fresh avocado toast.',
              'playing with my puppy.'
            ];
            return [constraint, phrases[idx]];
          });

          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: JSON.stringify(mockCouplets),
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Fourth call is T2 judging (Prompt 2 T2)
        if (mockResponseCount === 4) {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: '2',
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Fifth call is T3 generation (Prompt 1 T3)
        if (mockResponseCount === 5) {
          // Parse constraints from T3 prompt (includes word counts)
          const constraintMatches = prompt.match(/📋 YOUR 5 CONSTRAINTS.*?\n([\s\S]*?)\n\n🎬 FILM SCENE/);
          const constraintLines = constraintMatches ? constraintMatches[1].split('\n') : [];
          const constraints = constraintLines.map((line: string) => line.replace(/^\d+\.\s*/, '').trim());

          // Create couplets with proper constraints (phrases for T3)
          const mockCouplets = constraints.slice(0, 5).map((constraint: string, idx: number) => {
            const phrases = [
              'super sexy scenario!',
              'amazing automobile adventure.',
              'bouncing boobies bonanza!',
              'radical racing rivals?',
              'perfect puppy playtime.'
            ];
            return [constraint, phrases[idx]];
          });

          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: JSON.stringify(mockCouplets),
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Sixth call is T3 judging (Prompt 2 T3)
        if (mockResponseCount === 6) {
          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: '4',
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Seventh call is final quality judging
        if (mockResponseCount === 7) {
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

          return Promise.resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({
                      model: 'test',
                      created_at: '2024',
                      response: JSON.stringify(mockQualityAnswers),
                      done: false,
                    })),
                  })
                  .mockResolvedValueOnce({ done: true }),
              }),
            },
          });
        }

        // Fallback for any unexpected calls
        throw new Error(`Unexpected mock call #${mockResponseCount}`);
      };

      (global.fetch as any) = vi.fn(mockResponse);

      const result = await judgeTriplet(testFile, 1);

      // T1 (word) assertions
      expect(result.keyword).toBe('fruit'); // Last word of last frame
      expect(result.blankedScene).toContain('_____');
      expect(result.generatedWords).toHaveLength(5);
      expect(result.shuffledWords).toHaveLength(5);
      expect(result.bestWord).toBeDefined();
      expect(result.bestWordIndex).toBeGreaterThanOrEqual(0);
      expect(result.bestWordIndex).toBeLessThan(5);

      // T2 (phrase) assertions
      expect(result.secondScene).toBeDefined();
      expect(result.secondScene).toContain('[keyword]'); // Before replacement
      expect(result.secondSceneWithWord).toBeDefined();
      expect(result.secondSceneWithWord).toContain(result.bestWord); // After replacement with best word
      expect(result.secondSceneWithWord).not.toContain('[keyword]'); // [keyword] should be replaced
      expect(result.secondSceneWithWord).not.toContain('_____'); // Original text preserved (no blank yet)
      expect(result.generatedPhrases).toHaveLength(5);
      expect(result.shuffledPhrases).toHaveLength(5);
      expect(result.bestPhrase).toBeDefined();
      expect(result.bestPhraseIndex).toBeGreaterThanOrEqual(0);
      expect(result.bestPhraseIndex).toBeLessThan(5);

      // T3 (third scene) assertions
      expect(result.thirdScene).toBeDefined();
      expect(result.thirdScene).toContain('fruit'); // Original keyword present (case-insensitive)
      expect(result.thirdSceneWithWord).toBeDefined();
      expect(result.thirdSceneWithWord).toContain(result.bestWord); // Best word replaced
      expect(result.thirdSceneWithWord.toLowerCase()).not.toContain('fruit'); // Original keyword replaced (case-insensitive)
      expect(result.generatedPhrasesT3).toHaveLength(5);
      expect(result.shuffledPhrasesT3).toHaveLength(5);
      expect(result.bestPhraseT3).toBeDefined();
      expect(result.bestPhraseIndexT3).toBeGreaterThanOrEqual(0);
      expect(result.bestPhraseIndexT3).toBeLessThan(5);

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

    it.skip('should handle Ollama API errors gracefully with retries', async () => {
      const testDir = '/tmp/triplet-test';
      const tripletContent = `1
00:00:00,000 --> 00:00:02,000
Test content.

---

2
00:00:02,000 --> 00:00:04,000
[keyword] here.

3
00:00:04,000 --> 00:00:06,000
More text.

---

4
00:00:06,000 --> 00:00:08,000
Final content.`;

      const testFile = join(testDir, 'test2.txt');
      writeFileSync(testFile, tripletContent, 'utf-8');

      // Mock 3 failed attempts (initial + 2 retries)
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
        });

      await expect(judgeTriplet(testFile, 1)).rejects.toThrow(
        'Generate replacement words failed after 3 attempts'
      );
    });
  });
});
