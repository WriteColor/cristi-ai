import type { IToolHandler } from '../IToolHandler';
import { browserAutomationService } from '../../integrations/browser/BrowserAutomationService.js';
import { playwrightService } from '../../integrations/playwright/PlaywrightService.js';

export const searchInternetHandler: IToolHandler = {
  name: 'search_internet',
  declaration: {
    name: 'search_internet',
    description: 'Realiza una búsqueda en internet en tiempo real para obtener información actualizada, noticias, guías o datos de la web.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'La consulta o términos de búsqueda.'
        }
      },
      required: ['query']
    }
  },
  async execute(args: { query?: string }) {
    const query = args?.query || '';
    return await browserAutomationService.searchInternet(query);
  }
};

export const browseWebPageHandler: IToolHandler = {
  name: 'browse_web_page',
  declaration: {
    name: 'browse_web_page',
    description: 'Visita una página web específica y extrae su texto limpio y contenido para leerlo y responder al usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'La URL completa de la página web a consultar (ej: "https://es.wikipedia.org/wiki/...").'
        }
      },
      required: ['url']
    }
  },
  async execute(args: { url?: string }) {
    const url = args?.url || '';
    return await browserAutomationService.extractPageContent(url);
  }
};

export const openInBraveBrowserHandler: IToolHandler = {
  name: 'open_in_brave_browser',
  declaration: {
    name: 'open_in_brave_browser',
    description: 'Abre una URL directamente en el navegador Brave en el escritorio del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'La URL a abrir en Brave Browser.'
        }
      },
      required: ['url']
    }
  },
  async execute(args: { url?: string }) {
    const url = args?.url || '';
    const success = await browserAutomationService.openInBrave(url);
    return {
      status: success ? 'success' : 'error',
      url,
      message: success ? `Abriendo ${url} en Brave Browser.` : `No se pudo abrir ${url}.`
    };
  }
};

export const playwrightNavigateHandler: IToolHandler = {
  name: 'playwright_navigate',
  declaration: {
    name: 'playwright_navigate',
    description: 'Navega a cualquier sitio web o aplicación web completa usando Playwright en el navegador Brave con control autónomo total.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'La URL completa de destino (ej: "https://open.spotify.com", "https://youtube.com", "https://github.com").'
        }
      },
      required: ['url']
    }
  },
  async execute(args: { url?: string }) {
    return await playwrightService.navigate(args?.url || '');
  }
};

export const playwrightClickHandler: IToolHandler = {
  name: 'playwright_click',
  declaration: {
    name: 'playwright_click',
    description: 'Hace clic en un elemento interactivo, botón, enlace, pestaña o selector en la página web controlada por Playwright.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'Selector CSS, texto o XPath del elemento a cliquear.'
        }
      },
      required: ['selector']
    }
  },
  async execute(args: { selector?: string }) {
    return await playwrightService.click(args?.selector || '');
  }
};

export const playwrightFillHandler: IToolHandler = {
  name: 'playwright_fill',
  declaration: {
    name: 'playwright_fill',
    description: 'Escribe o rellena un campo de texto, barra de búsqueda o formulario en la página web actual.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'Selector CSS del campo a rellenar.'
        },
        value: {
          type: 'STRING',
          description: 'El texto o valor que se desea introducir.'
        }
      },
      required: ['selector', 'value']
    }
  },
  async execute(args: { selector?: string; value?: string }) {
    return await playwrightService.fill(args?.selector || '', args?.value || '');
  }
};

export const playwrightPressHandler: IToolHandler = {
  name: 'playwright_press',
  declaration: {
    name: 'playwright_press',
    description: 'Presiona una tecla del teclado en la página web activa (ej: "Enter", "Tab", "Escape", "ArrowDown").',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: {
          type: 'STRING',
          description: 'Nombre de la tecla a pulsar.'
        },
        selector: {
          type: 'STRING',
          description: 'Selector CSS opcional del elemento enfocado.'
        }
      },
      required: ['key']
    }
  },
  async execute(args: { key?: string; selector?: string }) {
    return await playwrightService.press(args?.selector || 'body', args?.key || 'Enter');
  }
};

export const playwrightScreenshotHandler: IToolHandler = {
  name: 'playwright_screenshot',
  declaration: {
    name: 'playwright_screenshot',
    description: 'Toma una captura de pantalla visual de la página web que Playwright está controlando.',
    parameters: {
      type: 'OBJECT',
      properties: {
        full_page: {
          type: 'BOOLEAN',
          description: 'Si es true, captura la página web completa con scroll.'
        }
      }
    }
  },
  async execute(args: { full_page?: boolean }) {
    return await playwrightService.screenshot({
      fullPage: Boolean(args?.full_page)
    });
  }
};

export const playwrightGetContentHandler: IToolHandler = {
  name: 'playwright_get_content',
  declaration: {
    name: 'playwright_get_content',
    description: 'Extrae el contenido de texto legible o HTML de la página web actual o de un contenedor específico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'Selector CSS opcional para extraer solo ese bloque de contenido.'
        }
      }
    }
  },
  async execute(args: { selector?: string }) {
    return await playwrightService.getContent(args?.selector as any);
  }
};

export const playwrightCloseHandler: IToolHandler = {
  name: 'playwright_close',
  declaration: {
    name: 'playwright_close',
    description: 'Cierra la sesión activa del navegador Playwright.'
  },
  async execute() {
    return await playwrightService.close();
  }
};

export const webTools: IToolHandler[] = [
  searchInternetHandler,
  browseWebPageHandler,
  openInBraveBrowserHandler,
  playwrightNavigateHandler,
  playwrightClickHandler,
  playwrightFillHandler,
  playwrightPressHandler,
  playwrightScreenshotHandler,
  playwrightGetContentHandler,
  playwrightCloseHandler
];
