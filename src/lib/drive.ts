export interface GalleryPhoto {
  src: string;
  cat: string;
  titulo: string;
  desc: string;
}

const CATEGORY_MAP: Record<string, { titulo: string; desc: string }> = {
  bodas:        { titulo: 'Boda',        desc: 'Ceremonias y recepciones' },
  xv:           { titulo: 'XV Años',     desc: 'Quinceañeras' },
  graduaciones: { titulo: 'Graduación',  desc: 'Celebración de logros' },
  bautizos:     { titulo: 'Bautizo',     desc: 'Celebración de bautizo' },
  cumpleanos:   { titulo: 'Cumpleaños',  desc: 'Fiestas de cumpleaños' },
  corporativos: { titulo: 'Corporativo', desc: 'Eventos empresariales' },
  centrosdemesa: { titulo: 'Centros de mesa', desc: 'Decoración para eventos' },
  fiestasinf: { titulo: 'Fiestas infantiles', desc: 'Celebraciones para niños' },
};

async function driveList(
  q: string,
  fields: string,
  apiKey: string,
  pageToken?: string
): Promise<{ files: any[]; nextPageToken?: string }> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', `files(${fields}),nextPageToken`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('pageSize', '100');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API ${res.status}: ${text}`);
  }
  return res.json();
}

async function listAll(q: string, fields: string, apiKey: string): Promise<any[]> {
  const all: any[] = [];
  let token: string | undefined;
  do {
    const page = await driveList(q, fields, apiKey, token);
    all.push(...(page.files ?? []));
    token = page.nextPageToken;
  } while (token);
  return all;
}

function normalizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '');
}

export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  const apiKey = import.meta.env.GOOGLE_DRIVE_API_KEY;
  const rootId = import.meta.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  if (!apiKey || !rootId) {
    console.warn(
      '[drive] Faltan variables de entorno GOOGLE_DRIVE_API_KEY o GOOGLE_DRIVE_ROOT_FOLDER_ID — usando array vacío'
    );
    return [];
  }

  const folders = await listAll(
    `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    'id,name',
    apiKey
  );

  const photos: GalleryPhoto[] = [];

  await Promise.all(
    folders.map(async (folder) => {
      const cat = normalizeFolderName(folder.name);
      const meta = CATEGORY_MAP[cat];
      if (!meta) {
        console.warn(`[drive] Carpeta ignorada (categoría desconocida): "${folder.name}"`);
        return;
      }

      const files = await listAll(
        `'${folder.id}' in parents and mimeType contains 'image/' and trashed = false`,
        'id,name',
        apiKey
      );

      for (const file of files) {
        photos.push({
          src: `https://lh3.googleusercontent.com/d/${file.id}`,
          cat,
          titulo: meta.titulo,
          desc: meta.desc,
        });
      }
    })
  );

  return photos;
}
