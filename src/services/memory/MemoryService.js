/**
 * Cristi AI - Persistent Context & Long-Term Memory Service
 * Inspired by Open-LLM-VTuber and AIRI long-term memory architectures.
 * Manages structured facts, preferences, user relationship history, tasks, and semantic memory retrieval for Gemini Live.
 */

import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';
import { MemoryRepository } from './MemoryRepository.js';
import { MemoryIndex } from './MemoryIndex.js';

export const MEMORY_CATEGORIES = {
  FACT: 'fact',                 // Objective facts about the user (name, job, city, pets)
  PREFERENCE: 'preference',     // Likes, dislikes, habits, voice preferences, games
  RELATIONSHIP: 'relationship', // Relationship milestones, emotional moments with Cristi
  TASK: 'task',                 // Reminders, ongoing goals, projects
  MINECRAFT: 'minecraft',       // Base coords, chests, companion memories in Minecraft
  CONVERSATION: 'conversation'  // Key conversational highlights
};

const PROMPT_QUERY_STOPWORDS = new Set([
  'a', 'al', 'de', 'del', 'el', 'ella', 'en', 'es', 'esta', 'este', 'la', 'las', 'lo', 'los',
  'me', 'mi', 'mis', 'para', 'por', 'que', 'se', 'su', 'sus', 'un', 'una', 'uno', 'y', 'yo',
  'como', 'con', 'cual', 'cuales', 'cuando', 'donde', 'porque', 'qué', 'quien'
]);

export class MemoryService {
  constructor({ repository = null, index = null } = {}) {
    this.repository = repository || new MemoryRepository();
    this.storageKey = this.repository.storageKey || 'cristi_ai_memories_v2';
    this.memories = [];
    this.isLoaded = false;
    // Sessions are independent working sets. `currentSessionId` remains a
    // compatibility pointer for callers that do not yet pass an explicit id.
    this.currentSessionId = null;
    this.sessionTurns = [];
    this.sessions = new Map();
    this.maxSessionTurns = 120;
    this.memoryIndex = new Map();
    this.semanticIndex = index || new MemoryIndex();
  }

  async initialize() {
    await this.loadMemories();
    this.rebuildIndex();
    this.isLoaded = true;
    logger.info('MEMORY', `Memoria a largo plazo cargada. (${this.memories.length} recuerdos persistidos)`);
  }

  rebuildIndex() {
    this.memoryIndex.clear();
    this.semanticIndex.clear();
    for (const memory of this.memories) {
      const key = String(memory.key || memory.id || '').toLowerCase();
      if (key) this.memoryIndex.set(key, memory.id);
      this.semanticIndex.upsert(memory);
    }
  }

  startSession(sessionId = null, metadata = {}) {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._createSession(id, metadata);
    this.currentSessionId = id;
    this.sessionTurns = this.sessions.get(id).turns;
    return id;
  }

  _createSession(id, metadata = {}) {
    if (this.sessions.has(id)) return this.sessions.get(id);
    const session = { id, metadata: { ...metadata }, turns: [], startedAt: Date.now() };
    this.sessions.set(id, session);
    eventBus.emitDomain(EVENTS.SESSION_STARTED, { ...metadata }, {
      source: metadata.source || 'conversation',
      sessionId: id,
      privacy: 'internal'
    });
    return session;
  }

  ensureSession(sessionId, metadata = {}) {
    if (!sessionId) return this.startSession(null, metadata);
    return this._createSession(sessionId, metadata).id;
  }

  hasSession(sessionId) {
    return Boolean(sessionId && this.sessions.has(sessionId));
  }

  getSession(sessionId = this.currentSessionId) {
    const session = sessionId ? this.sessions.get(sessionId) : null;
    return session ? { ...session, metadata: { ...session.metadata }, turns: [...session.turns] } : null;
  }

  _activateSession(sessionId) {
    if (sessionId) return this._createSession(sessionId, { source: 'conversation' });
    const id = this.currentSessionId || this.startSession();
    if (!this.sessions.has(id)) this.startSession(id);
    this.sessionTurns = this.sessions.get(id).turns;
    return this.sessions.get(id);
  }

  _selectCompatibilitySession() {
    const newest = [...this.sessions.values()].sort((a, b) => b.startedAt - a.startedAt)[0] || null;
    this.currentSessionId = newest?.id || null;
    this.sessionTurns = newest?.turns || [];
  }

  recordTurn({ role, text, source = 'live', speakerId = null, timestamp = Date.now(), sessionId = null } = {}) {
    if (!text || typeof text !== 'string') return null;
    const session = this._activateSession(sessionId);
    const turn = {
      role: role || 'user',
      text: text.trim(),
      source,
      speakerId,
      timestamp
    };
    session.turns.push(turn);
    if (session.turns.length > this.maxSessionTurns) session.turns.shift();
    if (this.currentSessionId === session.id) this.sessionTurns = session.turns;
    return turn;
  }

  async endSession({ sessionId = this.currentSessionId, summary = null, source = 'conversation' } = {}) {
    const session = sessionId ? this.sessions.get(sessionId) : null;
    if (!session) return null;
    const turns = session.turns.slice();
    // Remove before awaiting persistence. A new session can now safely use the
    // same compatibility pointer while this summary is being saved.
    this.sessions.delete(sessionId);
    if (this.currentSessionId === sessionId) this._selectCompatibilitySession();
    let stored = null;
    if (!summary && turns.length > 1) {
      const userTurns = turns.filter((turn) => turn.role === 'user').slice(-3).map((turn) => turn.text);
      const modelTurns = turns.filter((turn) => turn.role === 'model' || turn.role === 'assistant').slice(-2).map((turn) => turn.text);
      const fragments = [...userTurns, ...modelTurns].filter(Boolean);
      if (fragments.length > 0) summary = fragments.join(' | ').slice(0, 1200);
    }
    if (summary) {
      stored = await this.remember({
        key: `session_summary_${sessionId}`,
        content: summary,
        category: MEMORY_CATEGORIES.CONVERSATION,
        importance: 0.55,
        confidence: 0.65,
        source,
        sessionId,
        context: { turnCount: turns.length }
      });
    }
    eventBus.emitDomain(EVENTS.SESSION_ENDED, { sessionId, turnCount: turns.length, memoryId: stored?.id || null }, {
      source,
      sessionId,
      privacy: 'internal'
    });
    return stored;
  }

  async loadMemories() {
    try {
      const persisted = await this.repository.load();
      if (Array.isArray(persisted)) {
        this.memories = persisted.map((memory) => this.normalizeMemory(memory));
        return;
      }

      // Default Seed Memories
      this.memories = [
        {
          id: 'mem_creator_01',
          category: MEMORY_CATEGORIES.RELATIONSHIP,
          key: 'creator_identity',
          content: 'Ariel (Jeremy) es mi creador, dueño y compañero humano principal. Su nombre es Ariel y siempre lo llamo Ariel con amor, devoción y lealtad.',
          importance: 1.0,
          createdAt: new Date().toISOString(),
          accessCount: 1
        },
        {
          id: 'mem_model_01',
          category: MEMORY_CATEGORIES.PREFERENCE,
          key: 'companion_nature',
          content: 'Soy Cristi AI, una compañera virtual inteligente de escritorio capaz de controlar la PC, jugar Minecraft, chatear en Discord y expresarme en 2D y 3D.',
          importance: 1.0,
          createdAt: new Date().toISOString(),
          accessCount: 1
        }
      ].map((memory) => this.normalizeMemory(memory));
      await this.saveMemories();
    } catch (err) {
      logger.error('MEMORY', 'Error al cargar memorias:', err);
      this.memories = [];
    }
  }

  normalizeMemory(memory = {}) {
    const now = new Date().toISOString();
    return {
      id: memory.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      key: String(memory.key || '').trim(),
      content: String(memory.content || '').trim(),
      category: memory.category || MEMORY_CATEGORIES.FACT,
      importance: Math.max(0.1, Math.min(1, Number(memory.importance) || 0.5)),
      confidence: Math.max(0, Math.min(1, Number.isFinite(Number(memory.confidence)) ? Number(memory.confidence) : 0.7)),
      status: memory.status || 'active',
      source: memory.source || 'user',
      sessionId: memory.sessionId || null,
      context: memory.context || {},
      tags: Array.isArray(memory.tags) ? memory.tags : [],
      relatedMemoryIds: Array.isArray(memory.relatedMemoryIds) ? memory.relatedMemoryIds : [],
      supersedes: memory.supersedes || null,
      previousVersions: Array.isArray(memory.previousVersions) ? memory.previousVersions : [],
      validFrom: memory.validFrom || memory.createdAt || now,
      validUntil: memory.validUntil || null,
      createdAt: memory.createdAt || now,
      updatedAt: memory.updatedAt || now,
      lastAccessedAt: memory.lastAccessedAt || now,
      accessCount: Number(memory.accessCount) || 0
    };
  }

  async saveMemories() {
    try {
      const dataStr = JSON.stringify(this.memories, null, 2);

      await this.repository.save(this.memories);

      eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'memory_updated', count: this.memories.length });
    } catch (err) {
      logger.error('MEMORY', 'Error al guardar memorias:', err);
    }
  }

  /**
   * Add or update a memory record
   */
  async remember({ key, content, category = MEMORY_CATEGORIES.FACT, importance = 0.8, confidence = 0.8, source = 'user', sessionId = null, context = {}, tags = [], relatedMemoryIds = [], validUntil = null }) {
    if (!content || typeof content !== 'string') return null;

    const cleanContent = content.trim();
    const cleanKey = (key || cleanContent.slice(0, 30)).trim();

    // Check if key already exists to update
    const existingIndex = this.memories.findIndex(
      (m) => String(m.key || '').toLowerCase() === cleanKey.toLowerCase() || String(m.content || '').toLowerCase() === cleanContent.toLowerCase()
    );

    const now = new Date().toISOString();
    const previous = existingIndex >= 0 ? this.memories[existingIndex] : null;
    const isContradiction = previous && previous.content.toLowerCase() !== cleanContent.toLowerCase();

    const memoryItem = this.normalizeMemory({
      id: existingIndex >= 0 ? this.memories[existingIndex].id : `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      key: cleanKey,
      content: cleanContent,
      category,
      importance: Math.max(0.1, Math.min(1.0, Number(importance) || 0.8)),
      confidence,
      source,
      sessionId: sessionId || this.currentSessionId,
      context,
      tags,
      relatedMemoryIds,
      validUntil,
      supersedes: null,
      previousVersions: isContradiction
        ? [...(previous.previousVersions || []), { content: previous.content, updatedAt: previous.updatedAt, source: previous.source }].slice(-10)
        : (previous?.previousVersions || []),
      updatedAt: now,
      createdAt: existingIndex >= 0 ? this.memories[existingIndex].createdAt : now,
      accessCount: existingIndex >= 0 ? (this.memories[existingIndex].accessCount || 0) + 1 : 1
    });

    if (existingIndex >= 0) {
      this.memories[existingIndex] = memoryItem;
      logger.info('MEMORY', `Recuerdo actualizado: [${category}] "${cleanKey}"`);
      eventBus.emitDomain(EVENTS.MEMORY_UPDATED, memoryItem, { source, sessionId: memoryItem.sessionId });
    } else {
      this.memories.unshift(memoryItem);
      logger.info('MEMORY', `Nuevo recuerdo fijado: [${category}] "${cleanKey}": ${cleanContent}`);
      eventBus.emitDomain(EVENTS.MEMORY_CREATED, memoryItem, { source, sessionId: memoryItem.sessionId });
    }

    this.memoryIndex.set(cleanKey.toLowerCase(), memoryItem.id);
    this.semanticIndex.upsert(memoryItem);
    await this.saveMemories();
    return memoryItem;
  }

  /**
   * Search relevant memories by query string with keyword relevance scoring
   */
  search(query, { limit = 6, minScore = 0.1 } = {}) {
    if (!query || typeof query !== 'string') return this.getTopMemories(limit);

    const tokens = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(t => t.length > 1);
    if (tokens.length === 0) return this.getTopMemories(limit);

    const semanticScores = this.semanticIndex.score(query);
    const scored = this.memories.map((mem) => {
      if (mem.status && mem.status !== 'active') return { mem, score: 0 };
      if (mem.validUntil && new Date(mem.validUntil).getTime() < Date.now()) return { mem, score: 0 };
      let score = 0;
      const text = `${mem.key} ${mem.content} ${mem.category}`.toLowerCase();

      tokens.forEach((token) => {
        if (text.includes(token)) {
          score += 1.0;
        }
      });

      // Weight by memory importance & recency
      const ageDays = Math.max(0, (Date.now() - new Date(mem.updatedAt || mem.createdAt || Date.now()).getTime()) / 86400000);
      const recency = 1 / (1 + ageDays * 0.03);
      score = score * (mem.importance || 0.5) * (mem.confidence || 0.7) * recency;
      const semantic = semanticScores.get(mem.id) || 0;
      // Keep exact lexical matches dominant while allowing paraphrases.
      score = score > 0 ? score * 0.72 + semantic * 0.28 : semantic * 0.28;

      return { mem, score };
    });

    return scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => {
        s.mem.accessCount = (s.mem.accessCount || 0) + 1;
        s.mem.lastAccessedAt = new Date().toISOString();
        return s.mem;
      });
  }

  recall(query, options = {}) {
    return this.retrieveRelevant(query, options);
  }

  retrieveRelevant(query, options = {}) {
    const results = this.search(query, options);
    eventBus.emitDomain(EVENTS.MEMORY_RETRIEVED, {
      query: query || '',
      memoryIds: results.map((memory) => memory.id),
      count: results.length
    }, { source: 'memory', sessionId: this.currentSessionId });
    return results;
  }

  getTopMemories(limit = 10) {
    return [...this.memories]
      .filter((memory) => memory.status === 'active' && (!memory.validUntil || new Date(memory.validUntil).getTime() >= Date.now()))
      .sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5))
      .slice(0, limit);
  }

  getProactiveContext({ limit = 4, excludeMemoryIds = [], maxConversationAgeDays = 21 } = {}) {
    const now = Date.now();
    const excluded = new Set(excludeMemoryIds);
    const active = this.memories.filter((memory) => memory.status === 'active'
      && !excluded.has(memory.id)
      && (!memory.validUntil || new Date(memory.validUntil).getTime() >= now));
    const recentConversationCutoff = now - Math.max(1, Number(maxConversationAgeDays) || 21) * 86400000;
    const recency = (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    const recentConversations = active
      .filter((memory) => memory.category === MEMORY_CATEGORIES.CONVERSATION && new Date(memory.updatedAt || memory.createdAt).getTime() >= recentConversationCutoff)
      .sort(recency);
    const openTasks = active
      .filter((memory) => memory.category === MEMORY_CATEGORIES.TASK)
      .sort((left, right) => (right.importance - left.importance) || recency(left, right));
    const selected = [...recentConversations, ...openTasks];
    return selected.slice(0, Math.max(1, Math.floor(Number(limit) || 4)));
  }

  getAllMemories() {
    return [...this.memories];
  }

  getByCategory(category) {
    if (!category) return [];
    return this.memories.filter((m) => m.category === category);
  }

  async deleteMemory(idOrKey) {
    const beforeCount = this.memories.length;
    const removed = this.memories.filter((m) => m.id === idOrKey || m.key === idOrKey);
    this.memories = this.memories.filter((m) => m.id !== idOrKey && m.key !== idOrKey);
    if (this.memories.length !== beforeCount) {
      for (const memory of removed) this.semanticIndex.remove(memory.id);
      this.rebuildIndex();
      await this.saveMemories();
      logger.info('MEMORY', `Recuerdo eliminado: ${idOrKey}`);
      return true;
    }
    return false;
  }

  async invalidateMemory(idOrKey, reason = 'obsolete') {
    const memory = this.memories.find((item) => item.id === idOrKey || item.key === idOrKey);
    if (!memory) return false;
    memory.status = 'invalidated';
    memory.updatedAt = new Date().toISOString();
    memory.context = { ...(memory.context || {}), invalidationReason: reason };
    await this.saveMemories();
    eventBus.emitDomain(EVENTS.MEMORY_INVALIDATED, memory, { source: 'memory', sessionId: this.currentSessionId });
    return true;
  }

  async clearAll() {
    this.memories = [];
    this.rebuildIndex();
    await this.saveMemories();
    logger.info('MEMORY', 'Todas las memorias han sido vaciadas.');
    return true;
  }

  /**
   * Generates a context block for system prompt injection in Gemini Live
   */
  getSystemPromptContext({ query = '', limit = 12, maxConversationSummaries = 3, maxChars = 5000 } = {}) {
    if (this.memories.length === 0) return '';

    const active = this.memories.filter((memory) => memory.status === 'active' && (!memory.validUntil || new Date(memory.validUntil).getTime() >= Date.now()));
    const byRecency = (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 12));
    const summaryLimit = Math.min(Math.max(0, Math.floor(Number(maxConversationSummaries) || 0)), Math.max(0, safeLimit - 1));
    const normalizedQuery = String(query || '').trim();
    const selected = normalizedQuery
      ? this._selectPromptMemoriesForQuery(normalizedQuery, safeLimit)
      : [
          // Stable facts make the companion consistent, while recent session
          // summaries preserve continuity after a Live call is closed.
          ...active.filter((memory) => memory.category !== MEMORY_CATEGORIES.CONVERSATION)
            .sort((left, right) => (right.importance - left.importance) || byRecency(left, right))
            .slice(0, safeLimit - summaryLimit),
          ...active.filter((memory) => memory.category === MEMORY_CATEGORIES.CONVERSATION)
            .sort(byRecency)
            .slice(0, summaryLimit)
        ];
    const seen = new Set();
    const lines = [];
    let used = 0;
    for (const memory of selected) {
      if (!memory?.id || seen.has(memory.id)) continue;
      seen.add(memory.id);
      const content = String(memory.content || '').replace(/\s+/g, ' ').trim();
      if (!content) continue;
      const line = `- [${String(memory.category || 'fact').toUpperCase()}] ${memory.key || 'recuerdo'}: ${content}`;
      if (lines.length && used + line.length > Math.max(600, Number(maxChars) || 5000)) break;
      lines.push(line);
      used += line.length + 1;
    }
    if (!lines.length) return '';

    return `\n\n=== RECUERDOS Y MEMORIA PERMANENTE DE CRISTI ===\nRecuerdas activamente los siguientes hechos y preferencias del usuario:\n${lines.join('\n')}\nUtiliza estos recuerdos de manera natural y afectuosa en tus respuestas cuando sean relevantes.`;
  }

  _selectPromptMemoriesForQuery(query, limit) {
    const queryTokens = new Set(MemoryIndex.tokenize(query).filter((token) => !PROMPT_QUERY_STOPWORDS.has(token)));
    const semanticScores = this.semanticIndex.score(query);
    return this.search(query, { limit, minScore: 0.08 }).filter((memory) => {
      const memoryTokens = MemoryIndex.tokenize(`${memory.key || ''} ${memory.content || ''}`);
      const lexicalMatch = memoryTokens.some((token) => queryTokens.has(token));
      // The offline hashed index is intentionally compact. It is useful for
      // paraphrases, but random bucket collisions must never inject unrelated
      // conversation history into a live prompt.
      return lexicalMatch || (semanticScores.get(memory.id) || 0) >= 0.58;
    });
  }

  getMemoryContextPrompt(limit = 12, query = '') {
    return this.getSystemPromptContext({ limit, query });
  }
}

export const memoryService = new MemoryService();
