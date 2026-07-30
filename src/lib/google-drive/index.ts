import { DriveFolderNotAllowedError } from "./errors";
import { getGoogleAccessToken, isGoogleOAuthConfigured } from "./oauth";

export { DriveFolderNotAllowedError };

const folderMime = "application/vnd.google-apps.folder";

// Profundidad máxima al subir por la cadena de `parents` buscando la carpeta raíz
// de la empresa. Evita bucles y peticiones sin fin ante jerarquías inesperadas.
const MAX_TREE_DEPTH = 25;

export function isDriveConfigured() {
  return isGoogleOAuthConfigured();
}

/**
 * Nombre de la carpeta que el sistema crea por tarea: fecha de creación +
 * título. Reemplaza el prefijo `TK-<hex>` anterior, que no decía nada al
 * mirar la carpeta directamente en Drive.
 */
export function buildTaskFolderName(title: string, createdAt: string | Date) {
  const date = new Date(createdAt);
  const day = Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
  return `${day} - ${title}`.slice(0, 120);
}

/**
 * Los identificadores de Google Drive son cadenas seguras para URL. Validamos el
 * formato antes de usarlos: impide inyectar sintaxis en las consultas `q` y
 * descarta de entrada cualquier valor manipulado.
 */
export function isValidDriveId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(value);
}

function requireDriveId(value: unknown, label = "carpeta") {
  if (!isValidDriveId(value)) {
    throw new DriveFolderNotAllowedError(`El identificador de ${label} de Google Drive no es válido`);
  }
  return value;
}

/**
 * Comprueba que `folderId` sea la carpeta raíz de la empresa o una descendiente
 * suya, subiendo por la cadena de `parents`.
 *
 * Es la única defensa contra que un identificador enviado por el cliente apunte a
 * cualquier otra carpeta del Drive de la persona propietaria: todas las
 * operaciones se ejecutan con su token, así que sin esta comprobación el alcance
 * efectivo sería su cuenta entera. Debe llamarse ANTES de subir, mover, listar o
 * crear sobre cualquier identificador de origen externo.
 */
export async function assertFolderInCompanyTree(folderId: string, companyRootId: string, ownerId: string) {
  requireDriveId(folderId);
  requireDriveId(companyRootId, "carpeta raíz");
  if (folderId === companyRootId) return;

  const visited = new Set<string>([folderId]);
  let currentId = folderId;

  for (let depth = 0; depth < MAX_TREE_DEPTH; depth += 1) {
    const current = await driveFetch(
      `files/${encodeURIComponent(currentId)}?fields=id,parents&supportsAllDrives=true`,
      ownerId,
    );
    const parents = (current.parents ?? []) as string[];
    if (parents.includes(companyRootId)) return;

    const next = parents.find((parent) => isValidDriveId(parent) && !visited.has(parent));
    if (!next) break;
    visited.add(next);
    currentId = next;
  }

  throw new DriveFolderNotAllowedError();
}

async function driveFetch(path: string, ownerId: string, init: RequestInit = {}) {
  const token = await getGoogleAccessToken(ownerId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message ?? "Google Drive rechazó la operación");
  return result;
}

export async function verifyDriveFolder(folderId: string, ownerId: string) {
  const result = await driveFetch(`files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`, ownerId);
  if (result.mimeType !== folderMime) throw new Error("El enlace indicado no corresponde a una carpeta de Google Drive");
  return result as { id: string; name: string; webViewLink: string };
}

export async function createDriveFolder(name: string, parentId: string, ownerId: string) {
  const result = await driveFetch("files?fields=id,webViewLink,name&supportsAllDrives=true", ownerId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: folderMime, parents: [parentId] }),
  });
  return result as { id: string; name: string; webViewLink?: string };
}

export async function listDriveFolders(parentId: string, ownerId: string) {
  // `parentId` se interpola en la consulta `q` de Drive: validar el formato evita
  // que se inyecte sintaxis de búsqueda y se listen carpetas ajenas a la tarea.
  requireDriveId(parentId);
  const query = encodeURIComponent(`'${parentId}' in parents and mimeType='${folderMime}' and trashed=false`);
  const result = await driveFetch(`files?q=${query}&fields=files(id,name,webViewLink)&orderBy=name&includeItemsFromAllDrives=true&supportsAllDrives=true`, ownerId);
  return (result.files ?? []) as Array<{ id: string; name: string; webViewLink?: string }>;
}

export async function findOrCreateDriveFolder(name: string, parentId: string, ownerId: string) {
  const folders = await listDriveFolders(parentId, ownerId);
  const existing = folders.find((folder) => folder.name === name);
  return existing ?? createDriveFolder(name, parentId, ownerId);
}

export async function uploadToDrive(file: File, folderId: string, ownerId: string) {
  const token = await getGoogleAccessToken(ownerId);
  const metadata = { name: file.name, parents: [folderId] };
  const boundary = `taskkeep-${crypto.randomUUID()}`;
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const body = new Blob([prefix, await file.arrayBuffer(), suffix]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "No se pudo subir el archivo");
  return result as { id: string; webViewLink: string };
}

export async function moveDriveFile(fileId: string, fromFolderId: string | null, toFolderId: string, ownerId: string) {
  const params = new URLSearchParams({ addParents: toFolderId, fields: "id,webViewLink", supportsAllDrives: "true" });
  if (fromFolderId) params.set("removeParents", fromFolderId);
  const result = await driveFetch(`files/${encodeURIComponent(fileId)}?${params}`, ownerId, { method: "PATCH" });
  return result as { id: string; webViewLink?: string };
}

export async function deleteDriveFile(fileId: string, ownerId: string) {
  const token = await getGoogleAccessToken(ownerId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error?.message ?? "No se pudo eliminar el archivo de Drive");
  }
}
