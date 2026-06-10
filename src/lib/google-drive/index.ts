import { importPKCS8, SignJWT } from "jose";

async function accessToken() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Google Drive no está configurado");
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/drive" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description ?? "No se pudo autenticar Google Drive");
  return body.access_token as string;
}

export async function uploadToDrive(file: File, folderId: string) {
  const token = await accessToken();
  const metadata = { name: file.name, parents: [folderId] };
  const boundary = `taskkeep-${crypto.randomUUID()}`;
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const body = new Blob([prefix, await file.arrayBuffer(), suffix]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "No se pudo subir el archivo");
  return result as { id: string; webViewLink: string };
}
