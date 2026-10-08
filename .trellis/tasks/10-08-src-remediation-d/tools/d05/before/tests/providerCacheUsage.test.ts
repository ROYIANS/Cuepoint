import { describe, expect, it } from 'vitest';
import { streamChatCompletions } from '@/lib/ai/chatStream';
import { streamResponses } from '@/lib/ai/responsesStream';
import { historicalToolSummary } from '@/lib/agent/referenceEvidence';
const input = { connectorDefinitionId: 'openai-compatible', baseUrl: 'https://fixture.test/v1', apiKey: 'fixture', model: 'fixture', messages: [{ role: 'user' as const, content: 'hi' }] };
describe('provider reported cache usage', () => {
  it.each(['chat', 'responses'] as const)('keeps actual cache tokens separate from estimates on %s', async protocol => {
    const responses = protocol === 'responses';
    const transport = responses ? streamResponses : streamChatCompletions;
    const result = await transport(input, { fetchImpl: async () => Response.json(responses
      ? { id: 'r', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }], usage: { input_tokens: 200, output_tokens: 3, total_tokens: 203, input_tokens_details: { cached_tokens: 128 } } }
      : { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 200, completion_tokens: 3, total_tokens: 203, prompt_tokens_details: { cached_tokens: 128 } } }) });
    expect(result).toMatchObject({ ok: true, usage: { inputTokens: 200, cachedInputTokens: 128, outputTokens: 3, totalTokens: 203 } });
  });
  it('does not replay cached material prose through task history', () => {
    const result = historicalToolSummary('material_read_text', JSON.stringify({ materialId: 'm', revision: 2, chunks: [{ text: 'withdrawn-private-text' }], partial: true, nextStart: 3 }), 'p');
    expect(result).toMatchObject({ kind: 'historical_material_read', materialId: 'm', revision: 2, partial: true, nextStart: 3 });
    expect(JSON.stringify(result)).not.toContain('withdrawn-private-text');
  });
});
