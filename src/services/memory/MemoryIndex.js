/**
 * Bounded local memory index.
 *
 * The default hashed vector keeps retrieval useful offline and avoids adding a
 * model download to the Electron installer. A production embedding provider can
 * be supplied later through `setEmbedder` without changing MemoryService.
 */
export class MemoryIndex {
  constructor({ dimensions = 96, embedder = null } = {}) {
    this.dimensions = Math.max(16, Number(dimensions) || 96);
    this.embedder = typeof embedder === 'function' ? embedder : null;
    this.records = new Map();
    this.postings = new Map();
  }

  setEmbedder(embedder) {
    this.embedder = typeof embedder === 'function' ? embedder : null;
    for (const record of this.records.values()) record.vector = this.embed(record.text);
  }

  clear() {
    this.records.clear();
    this.postings.clear();
  }

  static tokenize(text = '') {
    return [...new Set(String(text)
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1))];
  }

  hashVector(text = '') {
    const vector = new Float32Array(this.dimensions);
    for (const token of MemoryIndex.tokenize(text)) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i += 1) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const index = (hash >>> 0) % this.dimensions;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[index] += sign;
      // A second independent bucket reduces collisions for short words.
      const index2 = ((hash >>> 7) ^ (hash >>> 16)) % this.dimensions;
      vector[index2 < 0 ? index2 + this.dimensions : index2] += sign * 0.5;
    }
    return this.normalize(vector);
  }

  embed(text) {
    const supplied = this.embedder?.(text);
    if (supplied && typeof supplied.length === 'number') {
      const vector = Float32Array.from(supplied).slice(0, this.dimensions);
      return this.normalize(vector);
    }
    return this.hashVector(text);
  }

  normalize(vector) {
    let norm = 0;
    for (const value of vector) norm += value * value;
    const divisor = Math.sqrt(norm) || 1;
    for (let i = 0; i < vector.length; i += 1) vector[i] /= divisor;
    return vector;
  }

  upsert(memory) {
    if (!memory?.id) return false;
    this.remove(memory.id);
    const text = `${memory.key || ''} ${memory.content || ''} ${memory.category || ''}`.trim();
    const tokens = MemoryIndex.tokenize(text);
    this.records.set(memory.id, { id: memory.id, text, vector: this.embed(text), tokens });
    for (const token of tokens) {
      let ids = this.postings.get(token);
      if (!ids) {
        ids = new Set();
        this.postings.set(token, ids);
      }
      ids.add(memory.id);
    }
    return true;
  }

  remove(id) {
    const record = this.records.get(id);
    if (!record) return false;
    this.records.delete(id);
    for (const token of record.tokens) {
      const ids = this.postings.get(token);
      ids?.delete(id);
      if (ids?.size === 0) this.postings.delete(token);
    }
    return true;
  }

  score(query, { candidateIds = null } = {}) {
    const queryTokens = MemoryIndex.tokenize(query);
    if (queryTokens.length === 0) return new Map();
    const candidates = candidateIds || new Set(this.records.keys());
    const queryVector = this.embed(query);
    const result = new Map();
    for (const id of candidates) {
      const record = this.records.get(id);
      if (!record) continue;
      let dot = 0;
      for (let i = 0; i < queryVector.length; i += 1) dot += queryVector[i] * record.vector[i];
      const lexical = queryTokens.reduce((sum, token) => sum + (record.tokens.includes(token) ? 1 : 0), 0) / queryTokens.length;
      result.set(id, Math.max(0, Math.min(1, dot * 0.55 + lexical * 0.45)));
    }
    return result;
  }

  search(query, { limit = 6, minScore = 0 } = {}) {
    const tokens = MemoryIndex.tokenize(query);
    const candidateIds = new Set();
    for (const token of tokens) {
      for (const id of this.postings.get(token) || []) candidateIds.add(id);
    }
    // Semantic matches may not share exact words; include all records when the
    // posting list is too small so paraphrases still have a chance to match.
    const candidates = candidateIds.size >= limit ? candidateIds : null;
    return [...this.score(query, { candidateIds: candidates })]
      .filter(([, score]) => score >= minScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score }));
  }
}

export default MemoryIndex;
