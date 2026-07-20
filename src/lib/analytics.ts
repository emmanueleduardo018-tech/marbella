/**
 * Analítica — capa fina sobre el `dataLayer` de Google Tag Manager.
 *
 * No conoce ningún proveedor concreto: solo empuja eventos al `dataLayer`,
 * que GTM consume para disparar GA4, Clarity, Meta Pixel, etc. Funciona
 * aunque GTM no esté configurado (los eventos se acumulan sin efecto).
 */

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

/**
 * Nombres de evento conocidos, con autocompletado. El `(string & {})` final
 * es un escape hatch: permite enviar nombres nuevos sin editar este tipo.
 */
export type AnalyticsEvent =
  | 'page_view'
  | 'gallery_image_click'
  | 'whatsapp_click'
  | 'phone_click'
  | 'contact_form_submit'
  | 'cta_click'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/** Datos opcionales que acompañan al evento (p. ej. `{ location: 'hero' }`). */
export type EventData = Record<string, unknown>;

/**
 * Envía un evento al `dataLayer`.
 *
 * @example
 *   trackEvent('whatsapp_click', { location: 'hero' });
 *   trackEvent('gallery_image_click', { imageId: 'xv_01', category: 'xv' });
 */
export function trackEvent(event: AnalyticsEvent, data: EventData = {}): void {
  // Guarda SSR: en build no hay `window`. No hacemos nada.
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
}

/**
 * Convierte un dataset `data-track-*` en el payload del evento.
 * `data-track` define el nombre; el resto de `data-track-<clave>` pasan a ser
 * propiedades (`data-track-location` → `location`). El bundler de Astro ya
 * entrega las claves en camelCase (`trackLocation`), así que solo hay que
 * quitar el prefijo `track`.
 */
function datasetToPayload(dataset: DOMStringMap): { event: string; data: EventData } | null {
  const event = dataset.track;
  if (!event) return null;

  const data: EventData = {};
  for (const [key, value] of Object.entries(dataset)) {
    if (key === 'track' || !key.startsWith('track') || value === undefined) continue;
    const prop = key.slice('track'.length);
    data[prop.charAt(0).toLowerCase() + prop.slice(1)] = value;
  }
  return { event, data };
}

/**
 * Registra un único listener delegado de clics. Cualquier elemento (o su
 * ancestro) con `data-track="<evento>"` dispara `trackEvent` al hacer clic,
 * leyendo sus `data-track-*` como propiedades. Evita añadir listeners por
 * componente. Llamar una vez al cargar la página (ver Layout).
 */
export function initClickTracking(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const el = target?.closest<HTMLElement>('[data-track]');
    if (!el) return;

    const payload = datasetToPayload(el.dataset);
    if (payload) trackEvent(payload.event, payload.data);
  });
}
