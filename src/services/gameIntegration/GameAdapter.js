/**
 * Port for a game integration. Concrete adapters (Mineflayer, RCON, mods,
 * WebSocket bridges) implement the same lifecycle and action surface.
 */
export class GameAdapter {
  constructor({ id, name }) {
    if (!id) throw new Error('GameAdapter requires an id');
    this.id = id;
    this.name = name || id;
  }

  async connect() { throw new Error(`${this.id} adapter does not implement connect()`); }
  async disconnect() {}
  async getState() { return {}; }
  async executeAction() { throw new Error(`${this.id} adapter does not implement executeAction()`); }
  onEvent() { return () => {}; }
}

export default GameAdapter;
