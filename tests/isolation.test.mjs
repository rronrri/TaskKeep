/**
 * Pruebas de aislamiento entre empresas y de permisos por rol.
 *
 * Por qué existen: la seguridad de TaskKeep no se apoya en RLS. Todo pasa por la
 * clave de servicio, así que el aislamiento depende de un `.eq("company_id", …)`
 * escrito a mano en cada consulta, repartido por más de treinta manejadores. Nada
 * avisa cuando uno se olvida.
 *
 * Se ejecutan contra un servidor y una base reales, no con simulaciones: el fallo
 * que se quiere detectar es precisamente una consulta mal filtrada, y sustituir la
 * base por un doble haría que la prueba pasara siempre.
 *
 * Cada caso deja constancia del incidente que lo motivó, para que quien lo vea
 * fallar en el futuro sepa qué se rompió y no lo tome por una regla arbitraria.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { api, cleanup, login, seed } from "./helpers.mjs";

let data;
const session = {};

before(async () => {
  data = await seed();
  for (const key of ["managerA", "collabA1", "collabA2", "managerB", "collabB1"]) {
    session[key] = await login(data.users[key].email);
  }
});

after(async () => {
  if (data) await cleanup(data);
});

describe("Aislamiento entre empresas", () => {
  it("una tarea de otra empresa no se puede leer", async () => {
    const { status } = await api(`/api/tasks/${data.tasks.A1}`, { cookie: session.managerB });
    assert.equal(status, 404);
  });

  it("el listado de tareas nunca incluye tareas ajenas", async () => {
    const { status, body } = await api("/api/tasks?size=50", { cookie: session.managerB });
    assert.equal(status, 200);
    const ids = (body.data ?? []).map((task) => task.id);
    assert.ok(!ids.includes(data.tasks.A1), "se filtró una tarea de otra empresa");
    assert.ok(!ids.includes(data.tasks.A2), "se filtró una tarea de otra empresa");
  });

  it("una tarea de otra empresa no se puede modificar", async () => {
    const { status } = await api(`/api/tasks/${data.tasks.A1}`, {
      method: "PATCH",
      cookie: session.managerB,
      body: { title: "Intento de intrusión" },
    });
    assert.notEqual(status, 200);
  });

  it("una tarea de otra empresa no se puede eliminar", async () => {
    const { status } = await api(`/api/tasks/${data.tasks.A1}`, { method: "DELETE", cookie: session.managerB });
    assert.notEqual(status, 200);
    const { rows } = await data.client.query("select deleted_at from tasks where id = $1", [data.tasks.A1]);
    assert.equal(rows[0].deleted_at, null, "la tarea ajena quedó marcada como eliminada");
  });

  it("no se puede comentar una tarea de otra empresa", async () => {
    const { status } = await api(`/api/tasks/${data.tasks.A1}/comments`, {
      method: "POST",
      cookie: session.managerB,
      body: { comment: "Intento de intrusión" },
    });
    assert.equal(status, 404);
  });

  it("el listado de carpetas sólo contiene las propias", async () => {
    const { status, body } = await api("/api/task-folders", { cookie: session.managerB });
    assert.equal(status, 200);
    const ids = (body.data ?? []).map((folder) => folder.id);
    assert.ok(!ids.includes(data.folders.A), "se filtró una carpeta de otra empresa");
  });

  it("no se puede robar una carpeta de otra empresa mediante la restauración", async () => {
    // Regresión de S6: el upsert usaba el identificador enviado por el cliente y
    // le imponía el company_id de quien llamaba, moviendo la carpeta de empresa.
    const { status } = await api("/api/task-folders", {
      method: "PATCH",
      cookie: session.managerB,
      body: {
        folders: [{ id: data.folders.A, name: "Robada", parent_id: null }],
        tasks: [],
      },
    });
    assert.notEqual(status, 200);
    const { rows } = await data.client.query("select company_id from task_folders where id = $1", [data.folders.A]);
    assert.equal(rows[0].company_id, data.companies.A, "la carpeta cambió de empresa");
  });

  it("un gestor no puede tocar cuentas de otra empresa", async () => {
    const { status } = await api(`/api/admin/users/${data.users.collabA1.id}`, {
      method: "PATCH",
      cookie: session.managerB,
      body: { full_name: "Intento de intrusión", email: "intruso@invalid.test" },
    });
    assert.equal(status, 404);
  });

  it("el listado de personas de un gestor sólo trae su empresa", async () => {
    const { status, body } = await api("/api/admin/users", { cookie: session.managerB });
    assert.equal(status, 200);
    const ids = (body.data ?? []).map((user) => user.id);
    assert.ok(!ids.includes(data.users.collabA1.id), "se filtró una cuenta de otra empresa");
  });
});

describe("Permisos por rol", () => {
  it("un colaborador no accede a la administración de empresas", async () => {
    const { status } = await api("/api/admin/companies", { cookie: session.collabA1 });
    assert.equal(status, 403);
  });

  it("un gestor tampoco accede a la administración de empresas", async () => {
    const { status } = await api("/api/admin/companies", { cookie: session.managerA });
    assert.equal(status, 403);
  });

  it("un colaborador no accede a la auditoría", async () => {
    const { status } = await api("/api/admin/audit-logs", { cookie: session.collabA1 });
    assert.equal(status, 403);
  });

  it("un colaborador no accede al panel de adopción", async () => {
    const { status } = await api("/api/admin/adoption", { cookie: session.collabA1 });
    assert.equal(status, 403);
  });

  it("un colaborador no accede a la bandeja de aprobaciones", async () => {
    const { status } = await api("/api/manager/status-requests", { cookie: session.collabA1 });
    assert.equal(status, 403);
  });

  it("un colaborador no obtiene el token de Google Drive del gestor", async () => {
    // Regresión de S1, el hallazgo crítico: el endpoint entregaba a cualquier
    // colaborador un token con acceso total al Drive de otra persona.
    const { status } = await api(`/api/tasks/${data.tasks.A1}/drive-picker-token`, { cookie: session.collabA1 });
    assert.equal(status, 403);
  });

  it("un colaborador sólo ve las tareas de las que es responsable", async () => {
    const { status, body } = await api("/api/tasks?size=50", { cookie: session.collabA1 });
    assert.equal(status, 200);
    const ids = (body.data ?? []).map((task) => task.id);
    assert.ok(ids.includes(data.tasks.A1), "no ve su propia tarea");
    assert.ok(!ids.includes(data.tasks.A2), "ve la tarea de otra persona de su empresa");
  });

  it("un colaborador no puede asignar tareas a otra persona", async () => {
    const { status, body } = await api("/api/tasks", {
      method: "POST",
      cookie: session.collabA1,
      body: {
        title: "zztest tarea asignada a otro",
        responsible_id: data.users.collabA2.id,
        priority: "low",
        reminder_mode: "none",
      },
    });
    // El servidor fuerza el responsable a quien llama en lugar de rechazar.
    if (status === 201) {
      assert.equal(body.data.responsible_id, data.users.collabA1.id, "se asignó a otra persona");
    } else {
      assert.notEqual(status, 200);
    }
  });

  it("un colaborador no puede eliminar la tarea de otra persona", async () => {
    const { status } = await api(`/api/tasks/${data.tasks.A2}`, { method: "DELETE", cookie: session.collabA1 });
    assert.equal(status, 403);
  });

  it("un colaborador no puede eliminar una carpeta que no creó", async () => {
    // Regresión de S4: podía borrar cualquier carpeta de su empresa y archivar de
    // paso las tareas de todo el equipo.
    const { status } = await api("/api/task-folders", {
      method: "DELETE",
      cookie: session.collabA1,
      body: { id: data.folders.A },
    });
    assert.equal(status, 403);
    const { rows } = await data.client.query("select id from task_folders where id = $1", [data.folders.A]);
    assert.equal(rows.length, 1, "la carpeta ajena fue eliminada");
  });
});

describe("Protecciones de sesión y de origen", () => {
  it("sin sesión no se accede a nada", async () => {
    for (const path of ["/api/tasks", "/api/profile", "/api/admin/companies", "/api/dashboard"]) {
      const { status } = await api(path);
      assert.equal(status, 401, `${path} respondió ${status} sin sesión`);
    }
  });

  it("una petición que modifica datos sin origen se rechaza", async () => {
    // Regresión de S8: la ausencia de la cabecera Origin era vía libre.
    const response = await fetch(`${process.env.TEST_BASE_URL ?? "http://localhost:3000"}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: session.managerA },
      body: JSON.stringify({ title: "sin origen", priority: "low" }),
    });
    assert.equal(response.status, 403);
  });

  it("revocar la sesión la invalida en el acto", async () => {
    // Regresión de S9: el token vivía 8 horas y no se comprobaba contra la base,
    // así que eliminar o desactivar una cuenta no cerraba su sesión.
    const cookie = await login(data.users.collabA2.email);
    assert.equal((await api("/api/auth/me", { cookie })).status, 200);

    await data.client.query("select bump_session_epoch($1)", [data.users.collabA2.id]);
    assert.equal((await api("/api/auth/me", { cookie })).status, 401);
  });

  it("desactivar una cuenta invalida su sesión", async () => {
    const cookie = await login(data.users.collabB1.email);
    assert.equal((await api("/api/auth/me", { cookie })).status, 200);

    await data.client.query("update users set is_active = false where id = $1", [data.users.collabB1.id]);
    assert.equal((await api("/api/auth/me", { cookie })).status, 401);
    await data.client.query("update users set is_active = true where id = $1", [data.users.collabB1.id]);
  });
});
