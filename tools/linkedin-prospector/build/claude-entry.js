// Bundled into lib/vendor/anthropic-sdk.js (Chrome extensions can't load remote code).
import Anthropic from '@anthropic-ai/sdk';
globalThis.Anthropic = Anthropic;
