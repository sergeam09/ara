# ARA — Augmented Reality Atelier

Plataforma personal para crear experiencias de realidad aumentada basadas en image tracking. El resultado es siempre un link que funciona directo en el navegador del espectador, sin app.

---

## Stack técnico

| Componente | Tecnología |
|---|---|
| Image tracking | MindAR.js 1.2.5 |
| Escenas AR | A-Frame |
| Modelos 3D | Model Viewer de Google |
| Hosting | GitHub Pages |
| Costo | $0 |

---

## Estructura del repositorio

```
ARA/
├── index.html          ← Tu panel Creator (solo tú lo usas)
├── viewer.html         ← Lo que ve el espectador
├── README.md
│
└── proyectos/
    └── nombre-proyecto/
        ├── trigger.jpg     ← La imagen de la obra (JPG, PNG, WEBP)
        ├── contenido.mp4   ← Tu contenido AR (mp4, gif, glb, mp3...)
        └── targets.mind    ← Archivo de tracking (ver instrucciones)
```

---

## Instalación en GitHub Pages

### 1. Crear repositorio

```bash
# En GitHub, crea un repo público llamado: ara-studio
# Luego clona en tu máquina:
git clone https://github.com/TU-USUARIO/ara-studio.git
cd ara-studio
```

### 2. Subir los archivos base

Copia `index.html` y `viewer.html` a la raíz del repo.

```bash
git add .
git commit -m "ARA: inicialización"
git push origin main
```

### 3. Activar GitHub Pages

En tu repo en GitHub:
- Settings → Pages
- Source: `Deploy from a branch`
- Branch: `main` → `/root`
- Guardar

Tu Creator estará en:
`https://TU-USUARIO.github.io/ara-studio/`

---

## Flujo para cada nuevo proyecto

### Paso 1 — Preparar la imagen trigger

La imagen trigger es la obra física que el teléfono va a reconocer.

**Requisitos:**
- Mínimo 500px de ancho
- JPG o PNG
- Buena variedad de contraste (las imágenes muy uniformes trackean mal)
- Sin demasiada simetría (dificulta el tracking)

Guárdala como `trigger.jpg`

### Paso 2 — Generar el archivo .mind

El archivo `.mind` es el "cerebro" del tracking. Lo genera MindAR gratuitamente:

1. Ve a: https://hiukim.github.io/mind-ar-js-doc/tools/compile
2. Sube tu `trigger.jpg`
3. Haz clic en **Start**
4. Descarga el archivo `targets.mind`

Este proceso tarda 10-30 segundos según la imagen.

### Paso 3 — Preparar el contenido AR

| Tipo | Formato | Tamaño recomendado | Herramienta de optimización |
|---|---|---|---|
| Video | MP4 (H.264) | < 30MB | handbrake.fr |
| GIF animado | GIF o WEBP | < 10MB | ezgif.com |
| Modelo 3D | GLB | < 20MB | gltf.report |
| Audio | MP3 | < 5MB | any audio editor |

Guárdalo como `contenido.mp4` (o la extensión que corresponda).

### Paso 4 — Subir al repositorio

```bash
# Crea la carpeta del proyecto
mkdir -p proyectos/nombre-de-tu-proyecto

# Copia tus archivos ahí
# trigger.jpg
# contenido.mp4
# targets.mind

git add proyectos/nombre-de-tu-proyecto/
git commit -m "ARA: nuevo proyecto - nombre-de-tu-proyecto"
git push origin main
```

### Paso 5 — Generar el link en el Creator

1. Abre `https://TU-USUARIO.github.io/ara-studio/`
2. Llena el formulario con el mismo nombre que usaste en la carpeta
3. Selecciona el tipo de contenido
4. Clic en **Generar experiencia AR**
5. Obtén tu link y QR

El link tendrá este formato:
```
https://TU-USUARIO.github.io/ara-studio/viewer.html?p=nombre-proyecto&t=video&ce=mp4&te=jpg
```

---

## Consejos para mejor tracking

**Imágenes que trackean bien:**
- Alta variedad de texturas y detalles
- Buena distribución del contraste
- Colores variados
- Sin demasiada simetría

**Imágenes que trackean mal:**
- Muy uniformes o lisas (cielos, fondos planos)
- Excesivamente simétricas
- Muy oscuras o sobreexpuestas
- Menos de 500px

**En la exposición:**
- Buena iluminación sobre la obra física
- Que el visitante pueda estar a 30-80cm de la obra
- Imprimir el QR en un tamaño visible (mínimo 3x3cm)

---

## Compatibilidad

| Dispositivo | Soporte |
|---|---|
| iPhone (Safari) | ✅ Excelente (ARKit) |
| iPad (Safari) | ✅ Excelente |
| Android Chrome | ✅ Bueno (ARCore) |
| Android gama baja | 🟡 Funcional, puede ser lento |
| Desktop Chrome/Firefox | ✅ Funciona (sin AR, modo preview) |

---

## Roadmap personal

- [ ] Soporte para múltiples targets en un mismo proyecto
- [ ] Overlay de texto con tipografía personalizada
- [ ] Efectos de partículas sobre la imagen
- [ ] Integración con Cloudflare Pages para archivos más grandes
- [ ] Panel de analytics básico

---

## Créditos técnicos

- [MindAR.js](https://github.com/hiukim/mind-ar-js) — MIT License
- [A-Frame](https://aframe.io) — MIT License  
- [Model Viewer](https://modelviewer.dev) — Apache 2.0
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) — MIT License
