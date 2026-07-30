# Google Drive en TaskKeep

Este documento resume lo necesario para configurar o cambiar la cuenta/proyecto de Google Drive usado por TaskKeep.

## Qué necesita TaskKeep

TaskKeep usa OAuth de Google para que cada gestor/a conecte su propia cuenta de Drive, independiente de la de otros/as gestores/as aunque compartan empresa. Los colaboradores/as no conectan Google: usan la conexión de quien los/las creó. No hay una carpeta raíz que configurar por separado: la carpeta de cada tarea se resuelve por su cuenta (ver "Cómo funciona en TaskKeep").

Hay **un solo proyecto de Google Cloud y un solo cliente OAuth** para toda la
aplicación: identifican a TaskKeep, no a las personas. Cada gestor/a autoriza
después su propia cuenta de Google desde su perfil.

### Alcance solicitado

TaskKeep pide `https://www.googleapis.com/auth/drive.file` (más `userinfo.email`
y `openid`). Es una decisión deliberada, no un detalle:

- `drive.file` da acceso **solo** a lo que la aplicación crea y a lo que la
  persona elige explícitamente en Google Picker. No al resto de su Drive.
- Google lo clasifica como alcance **no sensible**: la app se puede publicar sin
  proceso de verificación ni evaluación de seguridad anual por un tercero.
- El alcance amplio `auth/drive` es **restringido**: obliga a verificación y a una
  evaluación de seguridad externa para salir de modo prueba, y mientras la app
  está en pruebas los refresh tokens caducan a los 7 días, obligando a reconectar
  cada semana.

Consecuencia práctica: **cualquier carpeta que use TaskKeep se elige con el
selector de Google, no pegando un enlace.** Elegirla en el Picker es justamente lo
que la autoriza para la aplicación. Del mismo modo, TaskKeep solo ve las
subcarpetas que creó ella misma: una subcarpeta creada a mano desde Drive dentro
de la carpeta de una tarea no aparecerá en el explorador de la aplicación.

Variables necesarias:

```env
GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."
NEXT_PUBLIC_GOOGLE_API_KEY="..."
NEXT_PUBLIC_GOOGLE_APP_ID="..."
```

Valores del proyecto anterior, solo como referencia de formato (si creas un
proyecto nuevo hay que reemplazarlos y **cada gestor/a deberá reconectar**):

```env
GOOGLE_OAUTH_CLIENT_ID="1049985464679-01990l583vjj449mc9t5qev8l229v7nb.apps.googleusercontent.com"
NEXT_PUBLIC_GOOGLE_API_KEY="AIzaSyC2v3wkLwTQwIbMa6eEwOJ1-oT3BH6VEZg"
NEXT_PUBLIC_GOOGLE_APP_ID="1049985464679"
```

No guardar `GOOGLE_OAUTH_CLIENT_SECRET` en este archivo ni subirlo a GitHub. Debe estar solo en `.env.local` o en las variables secretas del hosting.

## APIs que deben estar habilitadas

En Google Cloud Console, dentro del proyecto de TaskKeep:

- Google Drive API
- Google Picker API

## Crear o cambiar proyecto de Google

1. Entrar a Google Cloud Console.
2. Crear o seleccionar el proyecto de TaskKeep.
3. Ir a **APIs y servicios > Biblioteca**.
4. Buscar y habilitar **Google Drive API**.
5. Buscar y habilitar **Google Picker API**.
6. Ir a **Google Auth Platform** o **Pantalla de consentimiento OAuth**.
7. Configurar:
   - Nombre de app: `TaskKeep`
   - Correo de soporte
   - Correos de contacto
   - Tipo **Externo** si se usará con cuentas fuera de la organización
8. En **Alcances (scopes)**, agregar únicamente:

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/userinfo.email
openid
```

   No agregar `https://www.googleapis.com/auth/drive`: es un alcance restringido y
   obliga a verificación con evaluación de seguridad externa.

9. Mientras la app esté en **modo prueba**, agregar como usuarios de prueba los
   correos de Google de cada gestor/a que vaya a conectar su Drive (tope de 100).
10. Con solo alcances no sensibles, se puede **publicar** la app (botón *Publicar
    aplicación*) sin pasar por verificación. Al publicarla desaparecen el límite
    de usuarios de prueba y la caducidad temprana de los tokens.

## Crear OAuth Client

1. Ir a **APIs y servicios > Credenciales**.
2. Pulsar **Crear credenciales > ID de cliente OAuth**.
3. Tipo de aplicación: **Aplicación web**.
4. Nombre sugerido: `TaskKeep Web`.
5. En **Orígenes JavaScript autorizados**, agregar:

```text
http://localhost:3000
https://TU-DOMINIO.com
```

6. En **URI de redireccionamiento autorizados**, agregar:

```text
http://localhost:3000/api/google/callback
https://TU-DOMINIO.com/api/google/callback
```

7. Copiar:

```env
GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."
```

Google muestra el secret completo solo al crearlo. Si se pierde, crear/rotar un secreto nuevo.

## Crear API Key para Picker

1. Ir a **APIs y servicios > Credenciales**.
2. Pulsar **Crear credenciales > Clave de API**.
3. Copiar el valor como:

```env
NEXT_PUBLIC_GOOGLE_API_KEY="..."
```

4. Restringir la clave:
   - API permitida: **Google Picker API**
   - Sitios permitidos:

```text
http://localhost:3000/*
https://TU-DOMINIO.com/*
```

## Obtener App ID

El `NEXT_PUBLIC_GOOGLE_APP_ID` es el número de proyecto usado por Picker. Normalmente coincide con la parte numérica antes del guion en el OAuth Client ID.

Ejemplo:

```text
1049985464679-xxxxx.apps.googleusercontent.com
```

Entonces:

```env
NEXT_PUBLIC_GOOGLE_APP_ID="1049985464679"
```

## Cómo funciona en TaskKeep

1. El/la gestor/a inicia sesión.
2. Si la contraseña es temporal, TaskKeep obliga a cambiarla.
3. Desde **Mi perfil**, el/la gestor/a pulsa **Conectar Google**. Cada gestor/a
   conecta su propia cuenta: es independiente de la de otros/as gestores/as de la
   misma empresa, no hay una carpeta ni una cuenta compartida.
4. Google pide autorización. TaskKeep guarda el refresh token cifrado (AES-256-GCM)
   asociado a esa persona (`users.google_refresh_token_encrypted`).
5. No hay una carpeta raíz que configurar por separado: en cuanto la tarea necesita
   Drive por primera vez (crearse, o subir el primer archivo), TaskKeep crea una
   carpeta propia para esa tarea directo en "Mi unidad" de quien la posee, nombrada
   con la fecha de creación y el título:

```text
2026-07-30 - Nombre de la tarea
```

   Desde la tarea también se puede elegir con el selector de Google una carpeta
   distinta para esa tarea en particular (útil si cada tarea debe ir a un lugar
   distinto de Drive).
6. "Quien posee" una tarea, es decir de qué gestor/a sale la conexión de Drive que
   se usa: si la persona responsable de la tarea es un/a gestor/a, su propia
   conexión; si es un/a colaborador/a, la conexión de quien lo/la creó
   (`users.created_by`).
7. Archivos de colaboradores/as:
   - Se suben directo a la carpeta de la tarea, igual que los de gestores/as.
   - Quedan en estado "pendiente" dentro de TaskKeep hasta que el/la gestor/a los aprueba o rechaza (es solo un estado, no una carpeta distinta en Drive).
   - Al aprobar, el/la gestor/a puede además moverlos a otra carpeta si elige una con el selector.
8. Borrar archivos (incluido el último) o borrar la tarea completa NUNCA borra la
   carpeta de la tarea en Drive: puede ser una carpeta que el/la gestor/a eligió a
   mano, no solo la automática.

## Si se cambia la cuenta/proyecto de Google

1. Crear nuevo OAuth Client o rotar el secret.
2. Actualizar variables:

```env
GOOGLE_OAUTH_CLIENT_ID="nuevo-client-id"
GOOGLE_OAUTH_CLIENT_SECRET="nuevo-client-secret"
NEXT_PUBLIC_GOOGLE_API_KEY="nueva-api-key"
NEXT_PUBLIC_GOOGLE_APP_ID="nuevo-app-id"
```

3. Reiniciar la aplicación.
4. Cada gestor/a debe volver a pulsar **Reconectar Google** desde su perfil. Con
   `drive.file` la autorización sobre una carpeta va ligada al cliente OAuth, así
   que un cliente nuevo no hereda los permisos del anterior: las tareas que ya
   tenían carpeta asignada con el cliente viejo necesitarán elegir una carpeta
   nueva desde la propia tarea.

## Si vienes de una versión con el alcance amplio

Las empresas que configuraron su carpeta con el alcance `auth/drive` (pegando un
enlace) dejarán de funcionar al cambiar a `drive.file`, porque la aplicación ya no
tiene permiso sobre esa carpeta. Cada gestor/a debe entrar en **Mi perfil** y
pulsar **Reconectar Google** (vuelve a pedir consentimiento, ahora con el alcance
nuevo); las tareas existentes necesitarán elegir una carpeta nueva desde la propia
tarea la primera vez que se use Drive con ellas.

Los archivos ya subidos siguen en Drive y no se tocan, pero TaskKeep solo podrá
operar sobre las carpetas y archivos que cree a partir de ese momento.

## Nota sobre `JWT_SECRET`

La clave que cifra los refresh tokens de Google se deriva de `JWT_SECRET`. Si se
rota esa variable, **todas las conexiones de Google quedan inservibles** y cada
gestor/a tiene que reconectar. Tenerlo en cuenta antes de rotarla.

## Producción

En el hosting de producción, configurar las mismas variables como secretos del entorno. No subir `.env.local` ni secrets al repositorio.

También confirmar en Google Cloud que el dominio real esté autorizado:

```text
https://TU-DOMINIO.com
https://TU-DOMINIO.com/api/google/callback
```
