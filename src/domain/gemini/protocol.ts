import type { TranscriptSnapshot } from '../transcription/TranscriptAssembler';
import { z } from 'zod';
const transcript = z.object({ text: z.string().max(65536).optional(), finished: z.boolean().optional() });
export const liveServerMessageSchema = z.object({
  setupComplete: z.object({}).optional(),
  sessionResumptionUpdate: z.object({ newHandle: z.string().optional(), handle: z.string().optional(), resumable: z.boolean().optional() }).optional(),
  serverContent: z.object({
    interrupted: z.boolean().optional(), turnComplete: z.boolean().optional(), generationComplete: z.boolean().optional(),
    interimInputTranscription: transcript.optional(), inputTranscription: transcript.optional(), outputTranscription: transcript.optional(),
    modelTurn: z.object({ parts: z.array(z.object({
      text: z.string().optional(), thought: z.boolean().optional(),
      inlineData: z.object({ data: z.string(), mimeType: z.string().optional() }).optional(),
    })).max(1000).optional() }).optional(),
  }).optional(),
  toolCall: z.object({ functionCalls: z.array(z.object({ id: z.string(), name: z.string(), args: z.record(z.unknown()).default({}) })).max(100) }).optional(),
  toolCallCancellation: z.object({ ids: z.array(z.string()).max(100) }).optional(),
  goAway: z.object({ timeLeft: z.string().optional() }).optional(),
});
export interface LiveToolResponse { id: string; name: string; output?: unknown; response?: { output?: unknown; result?: unknown }; }
export interface LiveToolCall { id: string; name: string; args: Record<string, unknown>; }
export interface LiveClientOptions {
  tokenProvider?: (model: string) => Promise<string>;
  modelId?: string; voiceName?: string; systemPrompt?: string;
  thinkingConfig?: { thinkingBudget?: number; thinkingLevel?: string } | null;
  temperature?: number; maxReconnectAttempts?: number; responseWatchdogMs?: number;
  sessionId?: string | null; includeCompanionContext?: boolean; tools?: unknown[] | null;
  vadSilenceDurationMs?: number; vadPrefixPaddingMs?: number;
  onOpen?: () => void; onSetupComplete?: () => void; onClose?: (event: CloseEvent) => void; onError?: (error: Error) => void;
  onAudioChunk?: (data: string) => void;
  onInputTranscription?: (text: string, snapshot?: TranscriptSnapshot) => void;
  onOutputTranscription?: (text: string, snapshot?: TranscriptSnapshot) => void;
  onInterrupted?: () => void; onTurnComplete?: () => void; onTextPart?: (text: string) => void;
  onToolCall?: (calls: LiveToolCall[], socket: WebSocket) => unknown;
  onReconnecting?: (attempt: number, delay: number) => void;
  onGenerationComplete?: () => void; onGenerationStart?: () => void;
  onToolCallCancellation?: (ids: string[]) => void;
}
