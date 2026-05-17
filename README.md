# Preparador de Oposiciones - Aragón

App para generar tests de oposiciones (DGA, Ayuntamiento de Zaragoza, Diputación Provincial).

## Características

- ✅ **Temario Común**: Preguntas sobre Constitución, Estatuto de Aragón, leyes administrativas
- ✅ **Convocatoria Específica**: Sube texto, enlace o PDF de la convocatoria
- ✅ **Historial**: Guarda tus resultados y visualiza tu progreso
- ✅ **Gráficas**: Evolución de notas y rendimiento por tema

## Requisitos

- Node.js 16+
- Cuenta en GitHub (para conectar con Vercel)

## Instalación Local

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev

# La app estará en http://localhost:3000
```

## Publicar en Vercel

### Paso 1: Preparar en GitHub

1. Abre GitHub.com y crea un nuevo repositorio público
2. Dale el nombre `preparador-oposiciones`
3. Haz clic en "Create repository"

### Paso 2: Subir el código a GitHub

```bash
# En tu terminal, desde la carpeta del proyecto

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/preparador-oposiciones.git
git push -u origin main
```

Cambia `TU_USUARIO` por tu usuario de GitHub.

### Paso 3: Conectar a Vercel

1. Ve a https://vercel.com
2. Haz clic en "Sign Up" y crea cuenta (o "Sign In" si ya tienes)
3. Haz clic en "New Project"
4. Selecciona "Import Git Repository"
5. Busca tu repositorio `preparador-oposiciones`
6. Haz clic en "Import"
7. Los ajustes deberían estar correctos. Haz clic en "Deploy"

**¡Listo!** Tu app estará disponible en una URL tipo: `https://preparador-oposiciones.vercel.app`

### Paso 4: Usar la App

Comparte el enlace con quien quieras. Ya tendrá:
- ✅ Carga de PDFs (ahora sí funciona)
- ✅ Historial guardado en el navegador
- ✅ Todo funcionando en web

## Notas

- El historial se guarda en el navegador del usuario (localStorage)
- Necesita la API key de Anthropic (Claude) en el cliente (esto es normal para demostración)
- En producción, podrías crear un backend para mayor seguridad

## Licencia

Libre para uso personal y educativo.
