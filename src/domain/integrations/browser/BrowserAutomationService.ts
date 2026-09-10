import { electronBridge } from '../../../services/desktop/ElectronBridge';

export interface PageContentResult {
  status: 'success' | 'error';
  message?: string;
  success?: boolean;
  content?: string;
  [key: string]: unknown;
}

export class BrowserAutomationService {
  async extractPageContent(url: string): Promise<PageContentResult> {
    try {
      const page = await electronBridge.playwrightExecute('navigate', { url });
      if (!page.success) return { status: 'error', message: (page.error as string) || 'Error de navegación' };
      const result = await electronBridge.playwrightExecute('get_content', {});
      return { ...result, status: result.success ? 'success' : 'error' };
    } catch (error) {
      return { status: 'error', message: String(error) };
    }
  }

  async searchInternet(query: string): Promise<PageContentResult> {
    if (!query || typeof query !== 'string') return { status: 'error', message: 'Consulta requerida.' };
    return this.extractPageContent('https://duckduckgo.com/?q=' + encodeURIComponent(query));
  }

  async openInBrave(url: string): Promise<boolean> {
    try {
      await electronBridge.openExternal(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const browserAutomationService = new BrowserAutomationService();
export default browserAutomationService;
