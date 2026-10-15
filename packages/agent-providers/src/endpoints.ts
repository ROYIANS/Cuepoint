import {normalizeBaseUrl} from './http/baseUrl.js';
export function authHeaders(apiKey: string): HeadersInit {
    return {Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json'};
}
export function chatCompletionsUrl(baseUrl: string): string {
    return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}
