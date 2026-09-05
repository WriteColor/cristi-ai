/**
 * Cristi AI - Persistent Context & Long-Term Memory Service
 * Inspired by Open-LLM-VTuber and AIRI long-term memory architectures.
 * Manages structured facts, preferences, user relationship history, tasks, and semantic memory retrieval for Gemini Live.
 */

import { electronBridge } from '../desktop/ElectronBridge.js';
import { logger } from '../logger.js';
import { eventBus, EVENTS } from '../eventBus.js';

export const MEMORY_CATEGORIES = {
  FACT: 'fact',                 // Objective facts about the user (name, job, city, pets)
  PREFERENCE: 'preference',     // Likes, dislikes, habits, voice preferences, games
  RELATIONSHIP: 'relationship', // Relationship milestones, emotional moments with Cristi
  TASK: 'task',                 // Reminders, ongoing goals, projects
  MINECRAFT: 'minecraft',       // Base coords, chests, companion memories in Minecraft
  CONVERSATION: 'conversation'  // Key conversational highlights
};

export class MemoryService {
  constructor() {
    this.storageKey = 'cristi_ai_memories_v2';
    this.memories = [];
    this.isLoaded = false;
  }

  async initialize() {
    await this.loadMemories();
    this.isLoaded = true;
    logger.info('MEMORY', `Memoria a largo plazo cargada. (${this.memories.length} recuerdos persistidos)`);
  }

  async loadMemories() {
    try {
      // 1. Try reading from persistent userData file via Electron Bridge
      if (electronBridge?.isElectron) {
        try {
          const fileData = await electronBridge.readFile('cristi-memories.json');
          if (fileData) {
            const parsed = JSON.parse(fileData);
            if (Array.isArray(parsed)) {
              this.memories = parsed;
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Fallback to localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        const local = localStorage.getItem(this.storageKey);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            this.memories = parsed;
            return;
          }
        }
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
      ];
      await this.saveMemories();
    } catch (err) {
      logger.error('MEMORY', 'Error al cargar memorias:', err);
      this.memories = [];
    }
  }

  async saveMemories() {
    try {
      const dataStr = JSON.stringify(this.memories, null, 2);

      // 1. Save to localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, dataStr);
      }

      // 2. Save to userData file
      if (electronBridge?.isElectron) {
        try {
          await electronBridge.writeFile('cristi-memories.json', dataStr);
        } catch (_) {}
      }

      eventBus.emit(EVENTS.CONFIG_CHANGED, { type: 'memory_updated', count: this.memories.length });
    } catch (err) {
      logger.error('MEMORY', 'Error al guardar memorias:', err);
    }
  }

  /**
   * Add or update a memory record
   */
  async remember({ key, content, category = MEMORY_CATEGORIES.FACT, importance = 0.8 }) {
    if (!content || typeof content !== 'string') return null;

    const cleanContent = content.trim();
    const cleanKey = (key || cleanContent.slice(0, 30)).trim();

    // Check if key already exists to update
    const existingIndex = this.memories.findIndex(
      (m) => m.key.toLowerCase() === cleanKey.toLowerCase() || (m.content.toLowerCase() === cleanContent.toLowerCase())
    );

    const memoryItem = {
      id: existingIndex >= 0 ? this.memories[existingIndex].id : `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      key: cleanKey,
      content: cleanContent,
      category,
      importance: Math.max(0.1, Math.min(1.0, Number(importance) || 0.8)),
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? this.memories[existingIndex].createdAt : new Date().toISOString(),
      accessCount: existingIndex >= 0 ? (this.memories[existingIndex].accessCount || 0) + 1 : 1
    };

    if (existingIndex >= 0) {
      this.memories[existingIndex] = memoryItem;
      logger.info('MEMORY', `Recuerdo actualizado: [${category}] "${cleanKey}"`);
    } else {
      this.memories.unshift(memoryItem);
      logger.info('MEMORY', `Nuevo recuerdo fijado: [${category}] "${cleanKey}": ${cleanContent}`);
    }

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

    const scored = this.memories.map((mem) => {
      let score = 0;
      const text = `${mem.key} ${mem.content} ${mem.category}`.toLowerCase();

      tokens.forEach((token) => {
        if (text.includes(token)) {
          score += 1.0;
        }
      });

      // Weight by memory importance & recency
      score = score * (mem.importance || 0.5);

      return { mem, score };
    });

    return scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => {
        s.mem.accessCount = (s.mem.accessCount || 0) + 1;
        return s.mem;
      });
  }

  recall(query, options = {}) {
    return this.search(query, options);
  }

  getTopMemories(limit = 10) {
    return [...this.memories]
      .sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5))
      .slice(0, limit);
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
    this.memories = this.memories.filter((m) => m.id !== idOrKey && m.key !== idOrKey);
    if (this.memories.length !== beforeCount) {
      await this.saveMemories();
      logger.info('MEMORY', `Recuerdo eliminado: ${idOrKey}`);
      return true;
    }
    return false;
  }

  async clearAll() {
    this.memories = [];
    await this.saveMemories();
    logger.info('MEMORY', 'Todas las memorias han sido vaciadas.');
    return true;
  }

  /**
   * Generates a context block for system prompt injection in Gemini Live
   */
  getSystemPromptContext() {
    if (this.memories.length === 0) return '';

    const top = this.getTopMemories(12);
    const lines = top.map((m) => `- [${m.category.toUpperCase()}] ${m.key}: ${m.content}`);

    return `\n\n=== RECUERDOS Y MEMORIA PERMANENTE DE CRISTI ===\nRecuerdas activamente los siguientes hechos y preferencias del usuario:\n${lines.join('\n')}\nUtiliza estos recuerdos de manera natural y afectuosa en tus respuestas cuando sean relevantes.`;
  }

  getMemoryContextPrompt(limit = 12) {
    return this.getSystemPromptContext();
  }
}

export const memoryService = new MemoryService();
