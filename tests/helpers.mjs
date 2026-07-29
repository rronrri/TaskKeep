import { Client } from "pg";
import bcrypt from "bcryptjs";

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "PruebaAislamiento-2026";

/**
 * Prefijo de todo lo que crean las pruebas. Sirve para limpiar sin ambigüedad y
 * para reconocer restos si una ejecución se interrumpe a medias.
 */
export const PREFIX = "zztest-aislamiento";

export function db() {
  const raw = process.env.POSTGRES_URL_NON_POOLING;
  if (!raw) throw new Error("Falta POSTGRES_URL_NON_POOLING");
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  return new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
}

/**
 * Petición a la API.
 *
 * Declara siempre `Origin`: el proxy exige demostrar mismo origen en todo lo que
 * modifica datos, y un cliente que no es un navegador debe hacerlo explícito.
 */
export async function api(path, { method = "GET", cookie, body } = {}) {
  const headers = { Origin: BASE };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Respuestas sin cuerpo (redirecciones, 204).
  }
  return { status: response.status, body: payload, headers: response.headers };
}

export async function login(email) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`Login falló para ${email}: ${response.status} ${await response.text()}`);
  }
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`El login de ${email} no devolvió cookie`);
  return cookie;
}

/**
 * Levanta dos empresas completas e independientes.
 *
 * Dos son el mínimo para que una fuga entre inquilinos sea observable: con una
 * sola empresa, olvidar un filtro por `company_id` no rompe ninguna prueba.
 */
export async function seed() {
  const client = db();
  await client.connect();

  // La suite inicia sesión siete veces y el límite del acceso es de diez cada
  // diez minutos: sin esto, dos ejecuciones seguidas se topan con un 429 y los
  // fallos parecerían de aislamiento cuando son del limitador haciendo su trabajo.
  //
  // Sólo vacía el contador compartido de PostgreSQL. El contador local de cada
  // instancia vive en memoria del proceso, así que para repetir la suite contra un
  // servidor ya arrancado hay que reiniciarlo. En integración continua no aplica:
  // cada ejecución levanta un proceso nuevo.
  await client.query("delete from rate_limit_hits where bucket_key like 'login:%'");

  const hash = await bcrypt.hash(PASSWORD, 10);
  const data = { client, companies: {}, users: {}, tasks: {}, folders: {} };

  const company = async (key, name) => {
    const { rows } = await client.query(
      "insert into companies (name, max_managers, max_collaborators) values ($1, 5, 20) returning id",
      [`${PREFIX}-${name}`],
    );
    data.companies[key] = rows[0].id;
  };

  const user = async (key, companyKey, role) => {
    // En minúsculas a propósito: la aplicación normaliza el correo al escribirlo y
    // lo busca en minúsculas al iniciar sesión, pero la base no tiene ninguna
    // restricción que lo garantice. Sembrar con mayúsculas crea una fila que
    // ninguna sesión podría encontrar.
    const email = `${PREFIX}-${key}@invalid.test`.toLowerCase();
    const { rows } = await client.query(
      `insert into users (company_id, full_name, email, role, password_hash, is_active, must_change_password)
       values ($1, $2, $3, $4, $5, true, false) returning id`,
      [data.companies[companyKey], `${PREFIX} ${key}`, email, role, hash],
    );
    data.users[key] = { id: rows[0].id, email, companyId: data.companies[companyKey] };
  };

  const task = async (key, companyKey, ownerKey) => {
    const { rows } = await client.query(
      `insert into tasks (company_id, created_by, responsible_id, title, priority, status)
       values ($1, $2, $2, $3, 'medium', 'pending') returning id`,
      [data.companies[companyKey], data.users[ownerKey].id, `${PREFIX} tarea ${key}`],
    );
    data.tasks[key] = rows[0].id;
  };

  const folder = async (key, companyKey, ownerKey) => {
    const { rows } = await client.query(
      "insert into task_folders (company_id, created_by, name) values ($1, $2, $3) returning id",
      [data.companies[companyKey], data.users[ownerKey].id, `${PREFIX} carpeta ${key}`],
    );
    data.folders[key] = rows[0].id;
  };

  await company("A", "empresa-a");
  await company("B", "empresa-b");

  await user("managerA", "A", "manager");
  await user("collabA1", "A", "collaborator");
  await user("collabA2", "A", "collaborator");
  await user("managerB", "B", "manager");
  await user("collabB1", "B", "collaborator");

  await task("A1", "A", "collabA1");
  await task("A2", "A", "collabA2");
  await task("B1", "B", "collabB1");

  await folder("A", "A", "managerA");
  await folder("Apropia", "A", "collabA1");
  await folder("B", "B", "managerB");

  return data;
}

/** Borra todo lo creado por las pruebas, en orden inverso a las dependencias. */
export async function cleanup(data) {
  const { client } = data;
  const companyIds = Object.values(data.companies);
  if (companyIds.length > 0) {
    await client.query("delete from notification_logs where task_id in (select id from tasks where company_id = any($1))", [companyIds]);
    await client.query("delete from task_status_logs where task_id in (select id from tasks where company_id = any($1))", [companyIds]);
    await client.query("delete from task_status_requests where task_id in (select id from tasks where company_id = any($1))", [companyIds]);
    await client.query("delete from task_comments where task_id in (select id from tasks where company_id = any($1))", [companyIds]);
    await client.query("delete from task_files where task_id in (select id from tasks where company_id = any($1))", [companyIds]);
    await client.query("delete from tasks where company_id = any($1)", [companyIds]);
    await client.query("delete from task_folders where company_id = any($1)", [companyIds]);
    await client.query("delete from audit_logs where company_id = any($1)", [companyIds]);
    await client.query("delete from users where company_id = any($1)", [companyIds]);
    await client.query("delete from companies where id = any($1)", [companyIds]);
  }
  await client.end();
}
