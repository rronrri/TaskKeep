const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    // El middleware exige demostrar mismo origen en toda petición que modifica
    // datos. Los clientes que no son navegadores deben declarar su Origin.
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login falló para ${email}: ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("El login no devolvió cookie de sesión");
  return cookie;
}

async function expectOk(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : undefined });
  if (!response.ok) throw new Error(`${path} respondió ${response.status}: ${await response.text()}`);
  return response.json().catch(() => null);
}

await expectOk("/api/health");

const managerEmail = process.env.TEST_MANAGER_EMAIL;
const managerPassword = process.env.TEST_MANAGER_PASSWORD;
if (managerEmail && managerPassword) {
  const cookie = await login(managerEmail, managerPassword);
  const tasks = await expectOk("/api/tasks?size=1", cookie);
  await expectOk("/api/dashboard", cookie);
  await expectOk("/api/profile", cookie);
  await expectOk("/api/manager/file-requests", cookie);
  if (tasks?.data?.[0]?.id) await expectOk(`/api/tasks/${tasks.data[0].id}`, cookie);
}

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const cookie = await login(adminEmail, adminPassword);
  await expectOk("/api/dashboard", cookie);
  await expectOk("/api/admin/audit-logs", cookie);
  await expectOk("/api/admin/notifications", cookie);
  await expectOk("/api/admin/system-status", cookie);
}

console.log("Smoke test completado correctamente.");
