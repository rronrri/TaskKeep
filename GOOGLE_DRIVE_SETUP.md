# Google Drive en TaskKeep

Este documento resume lo necesario para configurar o cambiar la cuenta/proyecto de Google Drive usado por TaskKeep.

## Qué necesita TaskKeep

TaskKeep usa OAuth de Google para que cada gestor/a conecte su propia cuenta y configure una carpeta raíz de Drive para su empresa. Los colaboradores/as no conectan Google: heredan la carpeta configurada por el/la gestor/a.

Variables necesarias:

```env
GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."
NEXT_PUBLIC_GOOGLE_API_KEY="..."
NEXT_PUBLIC_GOOGLE_APP_ID="..."
```

Variables actuales de referencia:

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
   - Tipo externo si se usará con cuentas fuera de la organización
8. Si la app está en modo testing, agregar los correos de prueba.

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
3. Desde **Mi perfil**, el/la gestor/a pulsa **Conectar Google**.
4. Google pide autorización.
5. Luego el/la gestor/a pega el enlace de una carpeta raíz de Drive.
6. TaskKeep valida la carpeta y la guarda para la empresa.
7. Cada tarea usa una carpeta propia:

```text
TK-xxxxxxxx - Nombre de la tarea
```

8. Archivos de colaboradores/as:
   - Se suben a la carpeta `Pendientes`.
   - El/la gestor/a los aprueba o rechaza.
   - Al aprobar, se mueven a la carpeta principal de la tarea o a una subcarpeta elegida.

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
4. Cada gestor/a debe volver a pulsar **Reconectar Google** desde su perfil.
5. Si se cambia también la carpeta raíz, pegar el nuevo enlace y guardar.

## Producción

En el hosting de producción, configurar las mismas variables como secretos del entorno. No subir `.env.local` ni secrets al repositorio.

También confirmar en Google Cloud que el dominio real esté autorizado:

```text
https://TU-DOMINIO.com
https://TU-DOMINIO.com/api/google/callback
```
