/**
 * Cloudinary — build-time gallery loader (fotos y videos).
 *
 * El contenido se gestiona en Cloudinary bajo carpetas por categoría
 * (marbella/<categoria>). En cada `build` se lista vía Admin API y se generan
 * URLs de entrega optimizadas (imágenes: f_auto,q_auto → AVIF/WebP; videos:
 * f_mp4,vc_auto,q_auto + póster desde frame), servidas desde el CDN de
 * Cloudinary. No requiere Sharp ni el VPS.
 */

export interface GalleryPhoto {
  /** Miniatura optimizada y recortada 4:3 para el grid. */
  src: string;
  /** srcset responsivo para el grid. */
  srcset: string;
  /** Versión grande optimizada para el lightbox. */
  full: string;
  cat: string;
  titulo: string;
  desc: string;
  width: number;
  height: number;
}

export interface GalleryVideo {
  /** Póster estático 9:16 (frame del video → jpg). */
  poster: string;
  /** mp4 optimizado, se carga solo al reproducir. */
  src: string;
  cat: string;
  titulo: string;
  width: number;
  height: number;
}

const CATEGORY_MAP: Record<string, { titulo: string; desc: string }> = {
  bodas:         { titulo: 'Boda',              desc: 'Ceremonias y recepciones' },
  xv:            { titulo: 'XV Años',           desc: 'Quinceañeras' },
  graduaciones:  { titulo: 'Graduación',        desc: 'Celebración de logros' },
  bautizos:      { titulo: 'Bautizo',           desc: 'Celebración de bautizo' },
  cumpleanos:    { titulo: 'Cumpleaños',        desc: 'Fiestas de cumpleaños' },
  corporativos:  { titulo: 'Corporativo',       desc: 'Eventos empresariales' },
  centrosdemesa: { titulo: 'Centros de mesa',   desc: 'Decoración para eventos' },
  fiestasinf:    { titulo: 'Fiestas infantiles', desc: 'Celebraciones para niños' },
};

const CLOUD_NAME = import.meta.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = import.meta.env.CLOUDINARY_API_KEY;
const API_SECRET = import.meta.env.CLOUDINARY_API_SECRET;
const ROOT = import.meta.env.CLOUDINARY_ROOT_FOLDER || 'marbella';

interface CldResource {
  public_id: string;
  resource_type: string;
  format: string;
  width: number;
  height: number;
  created_at: string;
}

/** Construye una URL de entrega de imagen de Cloudinary con transformaciones. */
export function cldUrl(publicId: string, transform: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

/** URL de entrega de video (mp4). */
export function cldVideo(publicId: string, transform: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${transform}/${publicId}.mp4`;
}

/** URL de póster (frame del video → jpg). */
export function cldPoster(publicId: string, transform: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${transform}/${publicId}.jpg`;
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
}

/** Devuelve los nombres de las subcarpetas directas de una carpeta. */
async function listSubfolders(folder: string): Promise<string[]> {
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders/${folder}`,
    { headers: { Authorization: authHeader() } }
  );
  if (!res.ok) {
    throw new Error(`Cloudinary Admin API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return ((data.folders ?? []) as { name: string }[]).map((f) => f.name);
}

/**
 * Lista (paginando) los recursos de una carpeta lógica de Cloudinary,
 * filtrando por tipo. `by_asset_folder` devuelve imágenes y videos mezclados,
 * así que filtramos del lado del cliente.
 */
async function listFolder(
  assetFolder: string,
  kind: 'image' | 'video' = 'image'
): Promise<CldResource[]> {
  const all: CldResource[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/by_asset_folder`
    );
    url.searchParams.set('asset_folder', assetFolder);
    url.searchParams.set('max_results', '500');
    if (cursor) url.searchParams.set('next_cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) {
      throw new Error(`Cloudinary Admin API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    for (const r of (data.resources ?? []) as CldResource[]) {
      if (r.resource_type === kind) all.push(r);
    }
    cursor = data.next_cursor;
  } while (cursor);

  return all;
}

/**
 * Recorre las carpetas de categoría existentes bajo ROOT y aplica `mapper` a
 * cada recurso del tipo indicado. Reutilizado por fotos y videos.
 */
async function walkCategories<T>(
  kind: 'image' | 'video',
  mapper: (r: CldResource, cat: string) => T
): Promise<T[]> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.warn(
      '[cloudinary] Faltan CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET — sin contenido'
    );
    return [];
  }

  // Solo consultamos las carpetas que existen y que son categorías conocidas.
  let cats: string[];
  try {
    const existentes = await listSubfolders(ROOT);
    cats = existentes.filter((name) => name in CATEGORY_MAP);
  } catch (err) {
    console.warn(`[cloudinary] No se pudieron listar subcarpetas de "${ROOT}":`, err);
    return [];
  }

  const perCat = await Promise.all(
    cats.map(async (cat) => {
      try {
        const resources = await listFolder(`${ROOT}/${cat}`, kind);
        // Más recientes primero dentro de cada categoría.
        resources.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return resources.map((r) => mapper(r, cat));
      } catch (err) {
        console.warn(`[cloudinary] Error listando "${ROOT}/${cat}" (${kind}):`, err);
        return [] as T[];
      }
    })
  );

  return perCat.flat();
}

function toPhoto(r: CldResource, cat: string): GalleryPhoto {
  const meta = CATEGORY_MAP[cat] ?? { titulo: cat, desc: '' };
  const id = r.public_id;

  // Miniatura de grid: recorte 4:3 (coincide con el aspect-ratio del CSS),
  // formato y calidad automáticos.
  const thumb = (w: number) =>
    cldUrl(id, `f_auto,q_auto,c_fill,ar_4:3,g_auto,w_${w}`);

  return {
    src: thumb(600),
    srcset: `${thumb(400)} 400w, ${thumb(600)} 600w, ${thumb(800)} 800w`,
    full: cldUrl(id, 'f_auto,q_auto,c_limit,w_1600'),
    cat,
    titulo: meta.titulo,
    desc: meta.desc,
    width: r.width,
    height: r.height,
  };
}

function toVideo(r: CldResource, cat: string): GalleryVideo {
  const meta = CATEGORY_MAP[cat] ?? { titulo: cat, desc: '' };
  const id = r.public_id;

  return {
    poster: cldPoster(id, 'so_auto,f_jpg,q_auto,c_fill,ar_9:16,w_400'),
    src: cldVideo(id, 'f_mp4,vc_auto,q_auto,w_480'),
    cat,
    titulo: meta.titulo,
    width: r.width,
    height: r.height,
  };
}

export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  return walkCategories('image', toPhoto);
}

export async function getGalleryVideos(): Promise<GalleryVideo[]> {
  return walkCategories('video', toVideo);
}
