# Guía del Servidor — Ubuntu 24.04 Multi-Cliente

## Resumen del Hardware

| Campo | Valor |
|-------|-------|
| OS | Ubuntu 24.04 LTS (x86_64) |
| RAM | 3.8 GB |
| Disco | 48 GB |
| IP pública | `2.24.194.56` |
| Usuario | `edu` (sudo sin contraseña) |

---

## Stack Instalado

```
┌─────────────────────────────────────────────────┐
│              Internet                            │
│                 │                                │
│            ┌────▼────┐                           │
│            │  Nginx  │  Reverse Proxy + SSL      │
│            │  1.24   │  (puertos 80/443)         │
│            └────┬────┘                           │
│       ┌─────────┼─────────┐                      │
│       ▼         ▼         ▼                      │
│   App1:3001 App2:xxxx  AppN:xxxx    ← PM2       │
│       │         │         │                      │
│   ┌───▼─────────▼─────────▼───┐                 │
│   │  PostgreSQL / Redis / DB  │                  │
│   └───────────────────────────┘                  │
│                                                  │
│   Docker · Python 3.12 · Node 24 · Git          │
│   fail2ban · ufw (22/80/443)                     │
└─────────────────────────────────────────────────┘
```

### Componentes

| Componente | Versión | Función |
|------------|---------|---------|
| **Nginx** | 1.24 | Reverse proxy, un `server {}` por app |
| **Certbot** | — | SSL Let's Encrypt automático |
| **Node.js** | 24 LTS (via nvm) | Runtime apps |
| **PM2** | 7 | Process manager, arranque en boot |
| **Python** | 3.12 + venv | Apps Python |
| **PostgreSQL** | — | Base de datos local |
| **Redis** | 7 | Cache / sesiones |
| **Docker** | 29 + Compose v5 | Containers si necesarios |
| **Git** | 2.43 | Control de versiones |
| **fail2ban** | — | Protección contra brute force |
| **ufw** | — | Firewall (solo 22, 80, 443 abiertos) |

---

## Estructura de Archivos

```
/home/edu/
└── .ssh/
    ├── barber_ia_deploy          ← Deploy key barber-ia
    └── otro_proyecto_deploy      ← Deploy key futuro proyecto

/var/www/
├── barber-ia/                    ← App barbería
│   ├── .env                      ← Variables (chmod 600)
│   ├── ecosystem.config.js       ← Config PM2
│   ├── server.js                 ← Backend Express (:3001)
│   └── client/dist/              ← Frontend build
│
├── otro-proyecto/                ← Futuro proyecto
│   ├── .env
│   ├── ecosystem.config.js
│   └── ...
```

---

## Cómo Funciona el Enrutamiento

```
app.barber-ia.xyz  →  Nginx  →  localhost:3001  →  PM2 (barber-ia)
otro.dominio.com   →  Nginx  →  localhost:XXXX  →  PM2 (otro-proyecto)
```

Nginx escucha en 80/443. Según el `server_name` del request, redirige al puerto local de la app correspondiente. Cada app corre en un puerto diferente.

---

## Cómo Agregar una Nueva Aplicación

### 1. Crear deploy key para GitHub

```bash
# Generar key
ssh-keygen -t ed25519 -C "nuevo-proyecto" -f ~/.ssh/nuevo_proyecto_deploy -N ""

# Agregar a SSH config
cat >> ~/.ssh/config << 'EOF'

Host github-nuevo-proyecto
    HostName github.com
    User git
    IdentityFile ~/.ssh/nuevo_proyecto_deploy
    IdentitiesOnly yes
EOF

# Copiar la PUBLIC key y agregarla en GitHub:
# Settings → Deploy keys → Add deploy key
cat ~/.ssh/nuevo_proyecto_deploy.pub
```

### 2. Clonar el repositorio

```bash
cd /var/www
sudo git clone git@github-nuevo-proyecto:usuario/repo.git nuevo-proyecto
sudo chown -R edu:edu nuevo-proyecto
cd nuevo-proyecto
```

### 3. Configurar la aplicación

```bash
# Instalar dependencias Node (si aplica)
npm install

# Crear archivo de环境变量s
nano .env
chmod 600 .env
# Agregar: PORT=3002, DATABASE_URL, API keys, etc.

# Si tiene frontend que necesita build
cd client && npm install && npm run build && cd ..
```

### 4. Crear ecosystem para PM2

```bash
nano ecosystem.config.js
```

Ejemplo:
```javascript
module.exports = {
  apps: [{
    name: 'nuevo-proyecto',
    script: 'server.js',           // o index.js, app.js, etc.
    cwd: '/var/www/nuevo-proyecto',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3002                    // Puerto ÚNICO para esta app
    }
  }]
}
```

### 5. Registrar en PM2

```bash
pm2 start ecosystem.config.js
pm2 save                            # Guarda el listado de procesos
# PM2 ya está configurado para arrancar en boot
```

Verificar:
```bash
pm2 status
curl http://localhost:3002         # Debe responder
```

### 6. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/nuevo-proyecto
```

Ejemplo:
```nginx
server {
    listen 80;
    server_name nuevo.dominio.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Si el frontend es estático (sin backend dinámico):
```nginx
server {
    listen 80;
    server_name nuevo.dominio.com;
    root /var/www/nuevo-proyecto/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 7. Activar el sitio en Nginx

```bash
sudo ln -s /etc/nginx/sites-available/nuevo-proyecto /etc/nginx/sites-enabled/
sudo nginx -t                      # Verificar sintaxis
sudo systemctl reload nginx        # Recargar config
```

### 8. Agregar SSL con Certbot

```bash
sudo certbot --nginx -d nuevo.dominio.com
```

Certbot:
- Modifica el config de Nginx automáticamente (agrega redirect 80→443)
- Obtiene certificado Let's Encrypt
- Configura renovación automática

Verificar:
```bash
sudo certbot certificates           # Listar certs activos
sudo systemctl status certbot.timer # Timer de renovación
```

### 9. Configurar logs

```bash
# PM2 ya maneja logs automáticamente en:
# ~/.pm2/logs/nuevo-proyecto-out.log
# ~/.pm2/logs/nuevo-proyecto-error.log

# Ver también en:
/var/log/pm2/                       # Si PM2 configurado con system paths
```

---

## Comandos Útiles

### PM2 — Gestión de procesos
```bash
pm2 status                           # Estado de todos los procesos
pm2 logs <nombre>                    # Logs en tiempo real
pm2 restart <nombre>                 # Reiniciar app
pm2 stop <nombre>                    # Detener app
pm2 delete <nombre>                  # Eliminar app de PM2
pm2 monit                            # Monitor interactivo
```

### Nginx —Reverse proxy
```bash
sudo nginx -t                        # Testear configuración
sudo systemctl reload nginx          # Recargar sin downtime
sudo systemctl restart nginx         # Reinicio completo
ls /etc/nginx/sites-enabled/         # Ver sitios activos
```

### SSL — Certbot
```bash
sudo certbot certificates            # Listar certificados
sudo certbot renew --dry-run         # Simular renovación
```

### Actualizar una app
```bash
cd /var/www/<proyecto>
git pull
npm install                          # Si hay deps nuevas
cd client && npm run build && cd ..  # Si cambió frontend
pm2 restart <proyecto>
```

---

## checklist — Nueva App

Copiar al crear proyecto nuevo:

```
[ ] 1. Deploy key generada en ~/.ssh/
[ ] 2. Key pública agregada en GitHub (Deploy keys)
[ ] 3. SSH config entry agregada
[ ] 4. Repo clonado en /var/www/<proyecto>
[ ] 5. Dependencias instaladas (npm install, pip install, etc.)
[ ] 6. .env configurado con chmod 600
[ ] 7. ecosystem.config.js creado
[ ] 8. Puerto único asignado (verificar que no esté en uso)
[ ] 9. PM2: pm2 start ecosystem.config.js && pm2 save
[ ] 10. App responde en localhost:puerto
[ ] 11. Config Nginx creado en sites-available
[ ] 12. Symlink creado en sites-enabled
[ ] 13. nginx -t pasa sin errores
[ ] 14. Nginx recargado
[ ] 15. DNS apuntando a 2.24.194.56
[ ] 16. Certbot ejecutado con --nginx
[ ] 17. HTTPS funciona
[ ] 18. Logs verificados (pm2 logs + nginx)
```

---

## Puertos en Uso

| Puerto | App | Proceso PM2 |
|--------|-----|-------------|
| 3001 | barber-ia | `barber-ia` |
| _libre_ | _próxima app_ | — |

> **Nota:** Cada app necesita un puerto único. Siguiente disponible: **3002**.
