/**
 * Cristi AI - Multi-layer Persistent & Semantic Memory Service (Domain Layer)
 * 
 * Manages long-term structured facts, user preferences, relationship milestones,
 * tasks, and game state memories. Features local 96-D hash vector semantic indexing,
 * SQLite/JSON atomic persistence, and autonomous contradiction resolution without
 * heavy neural network models.
 */

import type {
  ContradictionResolution,
  DomainEventEnvelope,
  MemoryCategory,
  MemoryItem,
  MemorySearchOptions,
  MemorySearchResult
} from '@/types';
import { electronBridge } from '@/services/desktop/ElectronBridge.js';
import { eventBus, EVENTS } from '@/services/eventBus.js';
import { logger } from '@/services/logger.js';

export interface IMemoryService {
  readonly memories: ReadonlyArray<MemoryItem>;
  readonly isLoaded: boolean;
  readonly currentSessionId: string | null;

  initialize(): Promise<void>;
  remember(params: {
    key?: string;
    content: string;
    category?: MemoryCategory;
    confidence?: number;
    source?: string;
    sessionId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  forget(idOrKey: string): Promise<boolean>;
  search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]>;
  getMemoryById(id: string): MemoryItem | null;
  getMemoryByKey(key: string): MemoryItem | null;
  getMemoriesByCategory(category: MemoryCategory, includeInactive?: boolean): MemoryItem[];
  resolveContradiction(
    newContent: string,
    key: string | undefined,
    category: MemoryCategory
  ): ContradictionResolution;
  startSession(sessionId?: string | null, metadata?: Record<string, unknown>): string;
  recordTurn(turn: {
    role: 'user' | 'model' | 'assistant' | 'system';
    text: string;
    source?: string;
    sessionId?: string | null;
  }): { role: string; text: string; timestamp: number };
  endSession(sessionId?: string | null): Promise<MemoryItem | null>;
  buildPromptContext(query?: string, maxItems?: number): Promise<string>;
}

export interface ConversationTurn {
  role: 'user' | 'model' | 'assistant' | 'system';
  text: string;
  source?: string;
  timestamp: number;
}

export interface WorkingSession {
  id: string;
  startedAt: number;
  metadata: Record<string, unknown>;
  turns: ConversationTurn[];
}

/**
 * 96-Dimension Bounded Local Semantic Hash Vector Index
 * Evaluates semantic and lexical similarity offline without any neural network download.
 */
export class LocalSemanticHashIndex {
  private readonly dimensions: number;
  private readonly records = new Map<string, { id: string; text: string; vector: Float32Array; tokens: string[] }>();
  private readonly postings = new Map<string, Set<string>>();

  constructor(dimensions = 96) {
    this.dimensions = Math.max(16, dimensions);
  }

  public clear(): void {
    this.records.clear();
    this.postings.clear();
  }

  public static tokenize(text = ''): string[] {
    return [
      ...new Set(
        String(text)
          .toLocaleLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((t) => t.length > 1)
      )
    ];
  }

  /**
   * Generates a 96-dimensional unit vector using dual-bucket FNV-1a hashing
   */
  public hashVector(text = ''): Float32Array {
    const vector = new Float32Array(this.dimensions);
    const tokens = LocalSemanticHashIndex.tokenize(text);

    for (const token of tokens) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i += 1) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const index = (hash >>> 0) % this.dimensions;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[index] += sign;

      // Secondary hash bucket to prevent hash collisions on short words
      const index2 = ((hash >>> 7) ^ (hash >>> 16)) % this.dimensions;
      const normalizedIndex2 = index2 < 0 ? index2 + this.dimensions : index2;
      vector[normalizedIndex2] += sign * 0.5;
    }

    // Cosine normalization to unit length
    let norm = 0;
    for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
    const divisor = Math.sqrt(norm) || 1;
    for (let i = 0; i < vector.length; i++) vector[i] /= divisor;

    return vector;
  }

  public upsert(memory: MemoryItem): void {
    if (!memory?.id) return;
    this.remove(memory.id);

    const text = `${memory.key || ''} ${memory.content || ''} ${memory.category || ''}`.trim();
    const tokens = LocalSemanticHashIndex.tokenize(text);
    const vector = this.hashVector(text);

    this.records.set(memory.id, { id: memory.id, text, vector, tokens });

    for (const token of tokens) {
      let ids = this.postings.get(token);
      if (!ids) {
        ids = new Set();
        this.postings.set(token, ids);
      }
      ids.add(memory.id);
    }
  }

  public remove(id: string): void {
    const record = this.records.get(id);
    if (!record) return;

    this.records.delete(id);
    for (const token of record.tokens) {
      const ids = this.postings.get(token);
      ids?.delete(id);
      if (ids?.size === 0) this.postings.delete(token);
    }
  }

  public score(query: string, candidateIds?: Set<string>): Map<string, number> {
    const queryTokens = LocalSemanticHashIndex.tokenize(query);
    if (queryTokens.length === 0) return new Map();

    const candidates = candidateIds || new Set(this.records.keys());
    const queryVector = this.hashVector(query);
    const results = new Map<string, number>();

    for (const id of candidates) {
      const record = this.records.get(id);
      if (!record) continue;

      // Cosine similarity between normalized vectors
      let dot = 0;
      for (let i = 0; i < queryVector.length; i++) {
        dot += queryVector[i] * record.vector[i];
      }

      // Lexical token overlap
      let matchedCount = 0;
      for (const t of queryTokens) {
        if (record.tokens.includes(t)) matchedCount++;
      }
      const lexical = matchedCount / queryTokens.length;

      // Hybrid score: 55% cosine semantic similarity + 45% lexical overlap
      const score = Math.max(0, Math.min(1, dot * 0.55 + lexical * 0.45));
      results.set(id, score);
    }

    return results;
  }

  public search(query: string, limit = 6, minScore = 0.25): Array<{ id: string; score: number }> {
    const tokens = LocalSemanticHashIndex.tokenize(query);
    const candidateIds = new Set<string>();

    for (const token of tokens) {
      const ids = this.postings.get(token);
      if (ids) {
        for (const id of ids) candidateIds.add(id);
      }
    }

    const candidates = candidateIds.size >= limit ? candidateIds : undefined;
    return [...this.score(query, candidates)]
      .filter(([, score]) => score >= minScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score }));
  }
}

/**
 * Atomic Multi-layer Persistence Adapter
 */
export class MemoryPersistenceAdapter {
  private readonly storageKey: string;
  private readonly filename: string;
  private readonly bridge: typeof electronBridge;

  constructor({
    storageKey = 'cristi_ai_memories_v2',
    filename = 'cristi-memories.json',
    bridge = electronBridge
  } = {}) {
    this.storageKey = storageKey;
    this.filename = filename;
    this.bridge = bridge;
  }

  public async load(): Promise<MemoryItem[] | null> {
    // 1. Electron IPC SQLite / JSON Native Load
    if (this.bridge?.isElectron) {
      try {
        const native = await this.bridge.memoryLoad?.();
        if (Array.isArray(native?.memories)) return native.memories;
      } catch (_) {}

      try {
        const fileData = await this.bridge.readFile(this.filename);
        if (fileData) {
          const parsed = JSON.parse(fileData);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }

    // 2. Browser LocalStorage Fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const local = window.localStorage.getItem(this.storageKey);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }

    return null;
  }

  public async save(memories: MemoryItem[]): Promise<boolean> {
    const data = JSON.stringify(memories, null, 2);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(this.storageKey, data);
      } catch (_) {}
    }

    if (this.bridge?.isElectron) {
      try {
        const native = await this.bridge.memorySave?.(memories);
        if (!native?.success) {
          await this.bridge.writeFile(this.filename, data);
        }
      } catch (_) {
        try {
          await this.bridge.writeFile(this.filename, data);
        } catch (_) {}
      }
    }

    return true;
  }
}

export class MemoryService implements IMemoryService {
  private readonly persistence: MemoryPersistenceAdapter;
  private readonly semanticIndex: LocalSemanticHashIndex;
  private readonly bus: typeof eventBus;

  public memories: MemoryItem[] = [];
  public isLoaded = false;
  public currentSessionId: string | null = null;

  private readonly sessions = new Map<string, WorkingSession>();
  private readonly maxSessionTurns = 100;

  constructor({
    persistence = new MemoryPersistenceAdapter(),
    semanticIndex = new LocalSemanticHashIndex(),
    bus = eventBus
  } = {}) {
    this.persistence = persistence;
    this.semanticIndex = semanticIndex;
    this.bus = bus;

    void this.initialize();
  }

  public async initialize(): Promise<void> {
    try {
      const persisted = await this.persistence.load();
      if (Array.isArray(persisted) && persisted.length > 0) {
        this.memories = persisted.map((m) => this.normalizeMemory(m));
      } else {
        // Seed bootstrap memories
        this.memories = this.createDefaultSeedMemories();
        await this.persistence.save(this.memories);
      }

      this.rebuildIndex();
      this.isLoaded = true;
      logger.info?.('MEMORY', `✓ Memoria multicapa inicializada (${this.memories.length} recuerdos indexados).`);
    } catch (err: any) {
      logger.error?.('MEMORY', 'Error al inicializar servicio de memoria:', err);
      this.memories = this.createDefaultSeedMemories();
      this.rebuildIndex();
      this.isLoaded = true;
    }
  }

  private createDefaultSeedMemories(): MemoryItem[] {
    const now = Date.now();
    return [
      {
        id: 'mem_creator_profile',
        key: 'creator_identity',
        category: 'relationship',
        content: 'Ariel (Jeremy) es mi creador, programador y compañero principal. Siempre me dirijo a él con devoción y calidez.',
        confidence: 1.0,
        source: 'system_bootstrap',
        createdAt: now,
        updatedAt: now,
        isActive: true
      },
      {
        id: 'mem_cristi_profile',
        key: 'cristi_identity',
        category: 'preference',
        content: 'Soy Cristi AI, una compañera virtual de escritorio hiperinteligente con avatar Live2D interactivo, capaz de jugar Minecraft, automatizar el navegador Brave y gestionar Discord.',
        confidence: 1.0,
        source: 'system_bootstrap',
        createdAt: now,
        updatedAt: now,
        isActive: true
      }
    ];
  }

  private normalizeMemory(raw: Partial<MemoryItem>): MemoryItem {
    const now = Date.now();
    return {
      id: raw.id || `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
      key: String(raw.key || '').trim() || undefined,
      category: raw.category || 'general',
      content: String(raw.content || '').trim(),
      confidence: Math.max(0, Math.min(1, typeof raw.confidence === 'number' ? raw.confidence : 0.8)),
      source: raw.source || 'user',
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
      sessionId: raw.sessionId || null,
      supersededBy: raw.supersededBy || null,
      isActive: raw.isActive !== false,
      metadata: raw.metadata || {}
    };
  }

  private rebuildIndex(): void {
    this.semanticIndex.clear();
    for (const memory of this.memories) {
      if (memory.isActive) {
        this.semanticIndex.upsert(memory);
      }
    }
  }

  /**
   * Detects and resolves contradictions between incoming information and existing memories
   */
  public resolveContradiction(
    newContent: string,
    key: string | undefined,
    category: MemoryCategory
  ): ContradictionResolution {
    const normalizedNew = newContent.toLowerCase().trim();
    const normalizedKey = (key || '').toLowerCase().trim();

    // 1. Direct Key Match Contradiction Check
    if (normalizedKey) {
      const existingByKey = this.memories.find(
        (m) => m.isActive && m.key && m.key.toLowerCase() === normalizedKey
      );

      if (existingByKey && existingByKey.content.toLowerCase().trim() !== normalizedNew) {
        return {
          detected: true,
          strategy: 'supersede',
          priorMemoryId: existingByKey.id,
          explanation: `Nueva afirmación para la clave "${key}" contradice el recuerdo previo "${existingByKey.content}".`
        };
      }
    }

    // 2. Semantic Similarity Contradiction Check (Negations or Opposite assertions in same category)
    const candidates = this.semanticIndex.search(newContent, 3, 0.45);
    for (const cand of candidates) {
      const existing = this.getMemoryById(cand.id);
      if (!existing || !existing.isActive || existing.category !== category) continue;

      const oldText = existing.content.toLowerCase();
      // Check for antonymic polarity (gusta vs disgusta/odia, vive en X vs vive en Y, es X vs es Y)
      const isPolarityConflict =
        (normalizedNew.includes('no me gusta') && (oldText.includes('me gusta') || oldText.includes('me encanta'))) ||
        (normalizedNew.includes('odio') && oldText.includes('me gusta')) ||
        (normalizedNew.includes('vivo en') && oldText.includes('vivo en') && normalizedNew !== oldText) ||
        (normalizedNew.includes('trabajo en') && oldText.includes('trabajo en') && normalizedNew !== oldText);

      if (isPolarityConflict) {
        return {
          detected: true,
          strategy: 'supersede',
          priorMemoryId: existing.id,
          explanation: `Conflicto de polaridad o valor semántico detectado con el recuerdo previo "${existing.content}".`
        };
      }
    }

    return { detected: false, strategy: 'none' };
  }

  /**
   * Remember: creates, updates, or supersedes memory records atomically
   */
  public async remember({
    key,
    content,
    category = 'general',
    confidence = 0.85,
    source = 'user',
    sessionId = null,
    metadata = {}
  }: {
    key?: string;
    content: string;
    category?: MemoryCategory;
    confidence?: number;
    source?: string;
    sessionId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    if (!content || typeof content !== 'string') {
      throw new Error('El contenido del recuerdo no puede estar vacío.');
    }

    const cleanContent = content.trim();
    const cleanKey = key?.trim();

    // Check for contradiction
    const contradiction = this.resolveContradiction(cleanContent, cleanKey, category);
    const now = Date.now();

    const newMemory = this.normalizeMemory({
      key: cleanKey,
      content: cleanContent,
      category,
      confidence,
      source,
      sessionId: sessionId || this.currentSessionId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      metadata: {
        ...metadata,
        contradictionResolved: contradiction.detected ? contradiction.strategy : undefined
      }
    });

    if (contradiction.detected && contradiction.priorMemoryId && contradiction.strategy === 'supersede') {
      const priorIdx = this.memories.findIndex((m) => m.id === contradiction.priorMemoryId);
      if (priorIdx >= 0) {
        this.memories[priorIdx].isActive = false;
        this.memories[priorIdx].supersededBy = newMemory.id;
        this.memories[priorIdx].updatedAt = now;
        this.semanticIndex.remove(this.memories[priorIdx].id);

        this.bus.emitDomain(
          EVENTS.MEMORY_UPDATED,
          {
            prior: this.memories[priorIdx],
            current: newMemory,
            resolution: contradiction
          },
          { source: 'memory_contradiction_resolver', sessionId }
        );
      }
    }

    // Check if identical key already exists to update
    if (cleanKey) {
      const existingIdx = this.memories.findIndex(
        (m) => m.isActive && m.key && m.key.toLowerCase() === cleanKey.toLowerCase()
      );
      if (existingIdx >= 0) {
        newMemory.id = this.memories[existingIdx].id;
        newMemory.createdAt = this.memories[existingIdx].createdAt;
        this.memories[existingIdx] = newMemory;
        this.semanticIndex.upsert(newMemory);
        await this.persistence.save(this.memories);

        this.bus.emitDomain(EVENTS.MEMORY_UPDATED, newMemory, { source, sessionId });
        return newMemory;
      }
    }

    this.memories.unshift(newMemory);
    this.semanticIndex.upsert(newMemory);
    await this.persistence.save(this.memories);

    this.bus.emitDomain(EVENTS.MEMORY_CREATED, newMemory, { source, sessionId });
    return newMemory;
  }

  public async forget(idOrKey: string): Promise<boolean> {
    if (!idOrKey) return false;
    const target = idOrKey.toLowerCase().trim();

    const index = this.memories.findIndex(
      (m) => m.id.toLowerCase() === target || (m.key && m.key.toLowerCase() === target)
    );

    if (index === -1) return false;

    const [removed] = this.memories.splice(index, 1);
    this.semanticIndex.remove(removed.id);
    await this.persistence.save(this.memories);

    this.bus.emitDomain(EVENTS.MEMORY_INVALIDATED, removed, { source: 'user_forget' });
    return true;
  }

  /**
   * Search semantic memory by query using hybrid cosine + lexical matching
   */
  public async search(query: string, options: MemorySearchOptions = {}): Promise<MemorySearchResult[]> {
    if (!query || typeof query !== 'string') return [];

    const limit = options.limit || 6;
    const minScore = options.minScore || 0.22;
    const matches = this.semanticIndex.search(query, limit * 2, minScore);

    const results: MemorySearchResult[] = [];

    for (const match of matches) {
      const memory = this.getMemoryById(match.id);
      if (!memory) continue;
      if (!options.includeInactive && !memory.isActive) continue;
      if (options.category && memory.category !== options.category) continue;

      results.push({ id: memory.id, memory, score: match.score });
      if (results.length >= limit) break;
    }

    if (results.length > 0) {
      this.bus.emitDomain(
        EVENTS.MEMORY_RETRIEVED,
        { query, matchCount: results.length, topScore: results[0].score },
        { source: 'memory_search' }
      );
    }

    return results;
  }

  public getMemoryById(id: string): MemoryItem | null {
    return this.memories.find((m) => m.id === id) || null;
  }

  public getMemoryByKey(key: string): MemoryItem | null {
    const clean = key.toLowerCase().trim();
    return this.memories.find((m) => m.isActive && m.key && m.key.toLowerCase() === clean) || null;
  }

  public getMemoriesByCategory(category: MemoryCategory, includeInactive = false): MemoryItem[] {
    return this.memories.filter((m) => m.category === category && (includeInactive || m.isActive));
  }

  // ── Short-Term Working Memory & Turn Tracking ──────────────────────────────
  public startSession(sessionId: string | null = null, metadata: Record<string, unknown> = {}): string {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.sessions.set(id, {
      id,
      startedAt: Date.now(),
      metadata: { ...metadata },
      turns: []
    });
    this.currentSessionId = id;

    this.bus.emitDomain(
      EVENTS.SESSION_STARTED,
      { sessionId: id, ...metadata },
      { source: 'session_manager', sessionId: id, privacy: 'internal' }
    );

    return id;
  }

  public recordTurn(turn: {
    role: 'user' | 'model' | 'assistant' | 'system';
    text: string;
    source?: string;
    sessionId?: string | null;
  }): { role: string; text: string; timestamp: number } {
    const targetSessionId = turn.sessionId || this.currentSessionId || this.startSession();
    let session = this.sessions.get(targetSessionId);
    if (!session) {
      this.startSession(targetSessionId);
      session = this.sessions.get(targetSessionId)!;
    }

    const recorded: ConversationTurn = {
      role: turn.role,
      text: turn.text.trim(),
      source: turn.source || 'conversation',
      timestamp: Date.now()
    };

    session.turns.push(recorded);
    if (session.turns.length > this.maxSessionTurns) {
      session.turns.shift();
    }

    return recorded;
  }

  public async endSession(sessionId: string | null = null): Promise<MemoryItem | null> {
    const targetId = sessionId || this.currentSessionId;
    if (!targetId || !this.sessions.has(targetId)) return null;

    const session = this.sessions.get(targetId)!;
    this.sessions.delete(targetId);
    if (this.currentSessionId === targetId) {
      this.currentSessionId = null;
    }

    // Consolidate session if turns exist
    let summaryMemory: MemoryItem | null = null;
    if (session.turns.length > 0) {
      const summaryText = session.turns
        .slice(-6)
        .map((t) => `${t.role}: ${t.text}`)
        .join(' | ')
        .slice(0, 500);

      summaryMemory = await this.remember({
        key: `session_summary_${targetId}`,
        content: `Resumen de sesión ${targetId}: ${summaryText}`,
        category: 'conversation',
        confidence: 0.9,
        source: 'session_consolidation',
        sessionId: targetId
      });
    }

    this.bus.emitDomain(
      EVENTS.SESSION_ENDED,
      { sessionId: targetId, turnCount: session.turns.length },
      { source: 'session_manager', sessionId: targetId, privacy: 'internal' }
    );

    return summaryMemory;
  }

  /**
   * Synthesizes prioritized prompt context for Gemini Live injection
   */
  public async buildPromptContext(query = '', maxItems = 8): Promise<string> {
    const facts = this.getMemoriesByCategory('fact');
    const preferences = this.getMemoriesByCategory('preference');
    const relationships = this.getMemoriesByCategory('relationship');

    const prioritized: MemoryItem[] = [];

    // Always include key relationships and creator facts
    for (const r of relationships.slice(0, 2)) prioritized.push(r);
    for (const f of facts.slice(0, 3)) prioritized.push(f);
    for (const p of preferences.slice(0, 3)) prioritized.push(p);

    // If query provided, search relevant semantic memories
    if (query) {
      const relevant = await this.search(query, { limit: 4, minScore: 0.25 });
      for (const res of relevant) {
        if (!prioritized.some((m) => m.id === res.memory.id)) {
          prioritized.push(res.memory);
        }
      }
    }

    const items = prioritized.slice(0, maxItems);
    if (items.length === 0) return '';

    return items.map((m) => `- [${m.category.toUpperCase()}] ${m.content}`).join('\n');
  }
}

export const memoryService = new MemoryService();
export default memoryService;
