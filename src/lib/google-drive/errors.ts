/**
 * Error de autorización sobre una carpeta de Drive: el identificador es inválido
 * o apunta fuera del árbol de la empresa. `apiError()` lo traduce a un 403.
 *
 * Vive en su propio módulo para que `src/lib/api.ts` pueda reconocerlo sin
 * arrastrar toda la integración de Drive a cada ruta.
 */
export class DriveFolderNotAllowedError extends Error {
  constructor(message = "La carpeta indicada no pertenece al espacio de Drive de la empresa") {
    super(message);
    this.name = "DriveFolderNotAllowedError";
  }
}
