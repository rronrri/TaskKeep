import { getGoogleAccessToken, isGoogleOAuthConfigured } from "./oauth";

const folderMime = "application/vnd.google-apps.folder";

export function isDriveConfigured() {
  return isGoogleOAuthConfigured();
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
