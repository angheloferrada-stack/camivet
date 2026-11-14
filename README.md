# Fichas Vet

App (PWA) para guardar fichas de pacientes veterinarios: **Clínica → Paciente (A–Z) → fichas, fotos y PDFs**.

- Plan gratis de Firebase (Spark), sin tarjeta: todo se guarda en Firestore (1 GB). Las fotos se comprimen al subirlas; ~600 PDFs de 500 KB ocupan unos 300 MB.
- Funciona en tablet, celular y computador. Se instala en la pantalla de inicio y abre sin internet.
- Nada se borra de verdad: "eliminar" manda a la **Papelera** y se puede restaurar. Además las reglas de Firebase **prohíben borrar** datos y archivos, aunque la app tenga un error.
- Ficha "Informe de Examen Oftálmico" rellenable (se guarda sola) y exportable a PDF.

## Probarla ahora (sin Firebase)
Sube la carpeta a GitHub Pages (paso 3) o ábrela con cualquier servidor local. Sin configurar Firebase queda en **modo prueba**: guarda solo en ese dispositivo. En Ajustes hay un botón para cargar ejemplos.

## Dejarla definitiva (nube + respaldo automático)

### 1. Crear el proyecto Firebase
1. Entra a https://console.firebase.google.com con una cuenta Google (la de ella o la tuya) → **Crear proyecto**.
2. **Authentication** → Comenzar → activar el proveedor **Google** (elige un correo de soporte) → guardar. Luego en **Configuración → Dominios autorizados** agrega `TU-USUARIO.github.io`. Ella entra con su propio Gmail.
3. **Firestore Database** → Crear base de datos (modo producción). Ubicación: **us-central1** → pestaña **Reglas** → pegar el contenido de `firestore.rules` (cambiando `REEMPLAZA@gmail.com` por el Gmail de ella) → Publicar.

**No actives Storage ni Blaze:** los PDFs y fotos también se guardan dentro de Firestore, así que se queda en el plan gratis **Spark**, sin tarjeta.

### 2. Conectar la app
Configuración del proyecto (engranaje) → Tus apps → **Web** (`</>`) → copia el bloque `firebaseConfig` y pégalo en `firebase-config.js`.

### 3. Publicar en GitHub Pages
1. Crea un repositorio en GitHub y sube todos los archivos de esta carpeta.
2. Settings → **Pages** → Source: rama `main`, carpeta `/ (root)` → Save. En un minuto queda en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.
3. Abre esa dirección en su tablet/celular → menú del navegador → **Agregar a pantalla de inicio** (en iPhone: Compartir → Agregar a inicio).

### 4. Pasar los ~600 PDFs que ya tiene
Ajustes → **Importar PDFs que ya tengo**. Elige la clínica y selecciona los PDFs de una carpeta. Cada archivo queda en un paciente con el nombre del archivo (los llamados "nuevo (1)" se marcan para ponerles el nombre correcto). Se hace carpeta por carpeta.

## Respaldo
Ajustes → **Descargar respaldo** baja un archivo con todas las clínicas, pacientes y fichas. Los PDFs y fotos quedan en Firestore (el respaldo no los incluye).

## Si cambias algo del código
Sube `CACHE` en `sw.js` (`fichasvet-v2`, `v3`…) para que los dispositivos tomen la versión nueva.
