# 👑 Marbella Princess Parties — Landing Page

Landing page en Astro con estilo blanco y rosa pastel, elegante y cálida.

## 🚀 Cómo arrancar

```bash
npm install
npm run dev
# Abre: http://localhost:4321
```

## 📁 Estructura

```
marbella/
├── public/
│   ├── favicon.svg
│   └── images/
│       ├── hero-bg.jpg         ← Foto de fondo del hero (la más importante)
│       ├── hero-card.jpg       ← Foto en la tarjeta flotante del hero
│       ├── nosotros-main.jpg   ← Foto grande sección Nosotros
│       ├── nosotros-2.jpg      ← Foto chica derecha
│       ├── nosotros-3.jpg      ← Foto chica fondo
│       ├── bodas/
│       │   ├── boda-1.jpg
│       │   ├── boda-2.jpg
│       │   └── boda-3.jpg
│       ├── xv/
│       │   ├── xv-1.jpg
│       │   ├── xv-2.jpg
│       │   └── xv-3.jpg
│       ├── graduaciones/
│       │   ├── grad-1.jpg
│       │   └── grad-2.jpg
│       ├── bautizos/
│       │   ├── bautizo-1.jpg
│       │   └── bautizo-2.jpg
│       ├── cumpleanos/
│       │   └── cumple-1.jpg
│       └── corporativos/
│           └── corp-1.jpg
└── src/
    ├── components/
    │   ├── Navbar.astro
    │   ├── Hero.astro
    │   ├── Services.astro
    │   ├── About.astro
    │   ├── Gallery.astro
    │   ├── Testimonials.astro
    │   ├── Contact.astro
    │   └── Footer.astro
    ├── layouts/Layout.astro
    ├── pages/index.astro
    └── styles/global.css
```

## ✏️ Qué debes cambiar primero

### 1. Número de WhatsApp
Busca `526641234567` en estos archivos y cámbialo:
- `src/components/Contact.astro` (línea `const WA_NUM` y el script al final)
- `src/components/Footer.astro` (dos lugares)

### 2. Email e Instagram
En `src/components/Contact.astro`:
```js
const EMAIL = 'hola@marbella.com';       // tu email real
const IG    = '@marbellaprincessparties'; // tu Instagram real
```

### 3. Tus fotos
Simplemente copia tus fotos a las carpetas en `public/images/`.
- Usa el mismo nombre que está en el array `fotos` de `Gallery.astro`
- O edita el array para que coincida con los nombres de tus fotos

### 4. Agregar más fotos a la galería
Abre `src/components/Gallery.astro` y agrega al array `fotos`:
```js
{ src:'/images/bodas/mi-foto.jpg', cat:'bodas', titulo:'Mi Boda', desc:'Descripción' },
```

### 5. Testimonios reales
Edita el array `reviews` en `src/components/Testimonials.astro`.

### 6. Estadísticas
En `src/components/Testimonials.astro` actualiza los números del banner de confianza.

## 🎨 Paleta de colores

Los colores están en `src/styles/global.css`:
- `--rosa`: #e8849a (rosa principal)
- `--rosa-oscuro`: #c95f78 (rosa oscuro / acentos)
- `--rosa-palido`: #fce8ed (rosa muy suave / fondos)
- `--blanco`: #fffaf8 (fondo principal)

## 🏗️ Build para producción

```bash
npm run build   # genera la carpeta dist/
npm run preview # previsualiza el build
```

Sube el contenido de `dist/` a tu hosting (Netlify, Vercel, etc.)
