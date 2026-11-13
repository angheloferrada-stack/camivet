# Fichas Vet

App (PWA) para guardar fichas de pacientes veterinarios: **Clínica → Paciente (A–Z) → fichas, fotos y PDFs**.

- Funciona en tablet, celular y computador. Se instala en la pantalla de inicio y abre sin internet.
- Nada se borra de verdad: "eliminar" manda a la **Papelera** y se puede restaurar. Además las reglas de Firebase **prohíben borrar** datos y archivos, aunque la app tenga un error.
- Ficha "Informe de Examen Oftálmico" rellenable (se guarda sola) y exportable a PDF.

## Probarla ahora (sin Firebase)
Sube la carpeta a GitHub Pages (paso 3) o ábrela con cualquier servidor local. Sin configurar Firebase queda en **modo prueba**: guarda solo en ese dispositivo. En Ajustes hay un botón para cargar ejemplos.

## Dejarla definitiva (nube + respaldo automático)

### 1. Crear el proyecto Firebase
1. Entra a https://console.firebase.google.com con una cuenta Google (la de ella o la tuya) → **Crear proyecto**.
2. **Authentication** → Comenzar → activar **Correo/contraseña** → pestaña Usuarios → **Agregar usuario** (el correo y clave con los que ella entrará).
3. **Firestore Database** → Crear base de datos (modo producción). Ubicación: **us-central1** → pestaña **Reglas** → pegar el contenido de `firestore.rules` → Publicar.
4. **Storage** → Comenzar. Exige activar el plan **Blaze** (hay que agregar una tarjeta). Elige la región **us-central1**, que entra en la cuota gratis (5 GB). Pestaña **Reglas** → pegar `storage.rules` → Publicar.
5. En Google Cloud → Facturación → **Presupuestos y alertas**: crea un presupuesto de, por ejemplo, 1 USD, para que avise si algo se pasa.

### 2. Conectar la app
Configuración del proyecto (engranaje) → Tus apps → **Web** (`</>`) → copia el bloque `firebaseConfig` y pégalo en `firebase-config.js`.

### 3. Publicar en GitHub Pages
1. Crea un repositorio en GitHub y sube todos los archivos de esta carpeta.
2. Settings → **Pages** → Source: rama `main`, carpeta `/ (root)` → Save. En un minuto queda en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.
3. Abre esa dirección en su tablet/celular → menú del navegador → **Agregar a pantalla de inicio** (en iPhone: Compartir → Agregar a inicio).

### 4. Pasar los ~600 PDFs que ya tiene
Ajustes → **Importar PDFs que ya tengo**. Elige la clínica y selecciona los PDFs de una carpeta. Cada archivo queda en un paciente con el nombre del archivo (los llamados "nuevo (1)" se marcan para ponerles el nombre correcto). Se hace carpeta por carpeta.

## Respaldo
Ajustes → **Descargar respaldo** baja un archivo con todas las clínicas, pacientes y fichas. Los PDFs y fotos quedan en Firebase Storage.

## Si cambias algo del código
Sube `CACHE` en `sw.js` (`fichasvet-v2`, `v3`…) para que los dispositivos tomen la versión nueva.
