import { describe, it, expect } from 'vitest';

/**
 * Integration tests for Ollama model performance
 * These tests validate that model changes don't break core functionality
 */

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen-fast'; // Optimized version of qwen2.5:14b (num_ctx=2048, num_batch=512)

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

async function callOllama(prompt: string, system?: string, temperature = 0.3): Promise<string> {
  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      system,
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const json: OllamaResponse = JSON.parse(line);
        fullResponse += json.response;
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
  }

  return fullResponse.trim();
}

describe('Ollama Integration Tests', () => {
  it('should answer a simple factual question correctly', async () => {
    const prompt = 'What is 2 + 2? Answer with just the number.';
    const response = await callOllama(prompt);

    // Should contain "4" somewhere in the response
    expect(response).toMatch(/4/);
  }, 30000); // 30s timeout

  it('should follow specific output format instructions', async () => {
    const system = 'You are a helpful assistant. Always respond in valid JSON format.';
    const prompt = `Generate a JSON object with two fields: "color" (a random color) and "number" (a random number 1-10).

Output format:
{"color": "...", "number": ...}

Respond with ONLY the JSON object, no explanations.`;

    const response = await callOllama(prompt, system, 0.7);

    // Should be valid JSON
    expect(() => JSON.parse(response)).not.toThrow();

    const parsed = JSON.parse(response);
    expect(parsed).toHaveProperty('color');
    expect(parsed).toHaveProperty('number');
    expect(typeof parsed.color).toBe('string');
    expect(typeof parsed.number).toBe('number');
  }, 30000);

  it('should generate creative content while respecting constraints', async () => {
    const system = 'You are a comedy writer. Generate funny, creative responses.';
    const prompt = `Generate 3 funny one-word punchlines for the sentence: "I love bananas."

Rules:
- EXACTLY 3 words
- Array format: ["word1", "word2", "word3"]
- Each word must be different
- No punctuation in words
- Single words only (no phrases)

Output ONLY the JSON array, no explanations.`;

    const response = await callOllama(prompt, system, 0.95);

    // Should be valid JSON array
    expect(() => JSON.parse(response)).not.toThrow();

    const parsed = JSON.parse(response);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);

    // All should be strings
    parsed.forEach((word: any) => {
      expect(typeof word).toBe('string');
      expect(word.length).toBeGreaterThan(0);
    });
  }, 30000);

  it('should handle complex reasoning tasks', async () => {
    const prompt = `Read this film scene and identify the keyword (last word of the last subtitle):

1
00:00:01,000 --> 00:00:03,000
I love bananas.

2
00:00:02,000 --> 00:00:04,000
They are my favorite fruit.

What is the keyword? Answer with just the word, lowercase, no punctuation.`;

    const response = await callOllama(prompt);

    // Should extract "fruit" from the scene
    expect(response.toLowerCase()).toMatch(/fruit/);
  }, 30000);

  it('should generate valid couplet arrays (Cinema Pippin format)', async () => {
    const system = 'You are a comedy writer for a party game.';
    const prompt = `Generate 3 word-constraint pairs in this exact format:

[["constraint 1", "word1"], ["constraint 2", "word2"], ["constraint 3", "word3"]]

Constraints:
1. The letter 'S' -- must start with S
2. Food-related -- about food
3. Animals -- about animals

Output ONLY the JSON array of couplets. No explanations.`;

    const response = await callOllama(prompt, system, 0.95);

    // Should be valid JSON
    expect(() => JSON.parse(response)).not.toThrow();

    const parsed = JSON.parse(response);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);

    // Each couplet should be [constraint, word]
    parsed.forEach((couplet: any) => {
      expect(Array.isArray(couplet)).toBe(true);
      expect(couplet.length).toBe(2);
      expect(typeof couplet[0]).toBe('string'); // constraint
      expect(typeof couplet[1]).toBe('string'); // word
    });

    // First word should start with 'S'
    const firstWord = parsed[0][1];
    expect(firstWord[0].toLowerCase()).toBe('s');
  }, 30000);

  it('should handle judging tasks (pick best option)', async () => {
    const system = 'You are an expert comedy judge.';
    const prompt = `Judge these 3 versions and pick the FUNNIEST:

VERSION 1: I love bananas because they are yellow.
VERSION 2: I love bananas because they are radioactive.
VERSION 3: I love bananas because they are fruit.

Output format: Just the number (1, 2, or 3), nothing else.`;

    const response = await callOllama(prompt, system, 0.3);

    // Should output a number 1, 2, or 3
    expect(response).toMatch(/[123]/);

    // Extract just the number
    const number = response.match(/[123]/)?.[0];
    expect(number).toBeDefined();
    expect(['1', '2', '3']).toContain(number);
  }, 30000);

  it('should maintain performance with high temperature', async () => {
    const startTime = Date.now();

    const prompt = 'Generate a random color name. Answer with just the color.';
    const response = await callOllama(prompt, undefined, 0.95);

    const duration = Date.now() - startTime;

    // Should respond in under 10 seconds (generous timeout)
    expect(duration).toBeLessThan(10000);

    // Should get a response
    expect(response.length).toBeGreaterThan(0);
  }, 15000);

  it('should verify optimized model configuration', async () => {
    // This test verifies qwen-fast is using optimized parameters
    const response = await fetch('http://localhost:11434/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: MODEL }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    // Verify model exists and has details
    expect(data).toHaveProperty('modelfile');

    // Check for optimization parameters (num_ctx and num_batch)
    const modelfile = data.modelfile;
    expect(modelfile).toContain('PARAMETER num_ctx 2048');
    expect(modelfile).toContain('PARAMETER num_batch 512');

    // Log current configuration for visibility
    console.log('\n📊 Model Configuration Verified:');
    console.log('✅ Model:', MODEL);
    console.log('✅ Context window: 2048 tokens');
    console.log('✅ Batch size: 512');
  }, 10000);

  it('should process requests efficiently (performance benchmark)', async () => {
    const startTime = Date.now();

    // Simulate a typical Cinema Pippin task
    const system = 'You are a helpful assistant. Respond ONLY with valid JSON, no explanations.';
    const prompt = `Generate 3 funny words in JSON array format.

Output ONLY this format: ["word1", "word2", "word3"]

No explanations, just the JSON array.`;

    const response = await callOllama(prompt, system, 0.95);

    const duration = Date.now() - startTime;

    // Try to parse - should be valid JSON or contain a JSON array
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      // Sometimes response has extra text, try to extract JSON array
      const match = response.match(/\[.*\]/s);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error(`Could not parse response: ${response}`);
      }
    }

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // With qwen-fast, this should be fast (under 5 seconds)
    console.log(`\n⏱️  Performance benchmark: ${duration}ms`);

    // Should be reasonably fast (allowing some variance)
    expect(duration).toBeLessThan(8000);
  }, 15000);
});
