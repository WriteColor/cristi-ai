/**
 * Port for a game integration. Concrete adapters (Mineflayer, RCON, mods,
 * WebSocket bridges) implement the same lifecycle and action surface.
 */
export class GameAdapter {
  public id: string;
  public name: string;

  constructor({ id, name }: { id: string; name?: string }) {
    if (!id) throw new Error('GameAdapter requires an id');
    this.id = id;
    this.name = name || id;
  }

  async connect(): Promise<unknown> {
    throw new Error(`${this.id} adapter does not implement connect()`);
  }

  async disconnect(): Promise<void> {}

  async getState(): Promise<Record<string, unknown>> {
    return {};
  }

  async executeAction(_action: string, _params?: Record<string, unknown>): Promise<unknown> {
    throw new Error(`${this.id} adapter does not implement executeAction()`);
  }

  onEvent(_callback: (event: unknown) => void): () => void {
    return () => {};
  }
}

export default GameAdapter;
