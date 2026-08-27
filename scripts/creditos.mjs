/**
 * =====================================================================
 *  Registro de créditos de imágenes.
 *
 *  Los scripts de portadas, plataformas y estudios escriben cada uno su
 *  sección en CREDITOS-IMAGENES.md sin pisar las de los demás.
 * =====================================================================
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CABECERA = [
  '# Créditos de las imágenes',
  '',
  'Este archivo se genera automáticamente con los scripts de la carpeta',
  '`scripts/`. Recoge el origen y la licencia de cada imagen del catálogo.',
  '',
].join('\n');

/**
 * Escribe o reemplaza una sección del archivo de créditos.
 *
 * @param {string} ruta   ubicación de CREDITOS-IMAGENES.md
 * @param {string} id     identificador de la sección, p. ej. 'plataformas'
 * @param {string[]} lineas contenido de la sección, incluido su encabezado
 */
export function guardarSeccion(ruta, id, lineas) {
  const inicio = `<!-- seccion:${id} -->`;
  const fin = `<!-- /seccion:${id} -->`;
  const bloque = [inicio, ...lineas, fin, ''].join('\n');

  let contenido = existsSync(ruta) ? readFileSync(ruta, 'utf-8') : '';

  // Un archivo de una versión anterior no tiene marcas: se empieza de nuevo.
  if (contenido && !contenido.includes('<!-- seccion:')) contenido = '';
  if (!contenido) contenido = CABECERA;

  const desde = contenido.indexOf(inicio);
  const hasta = contenido.indexOf(fin);

  if (desde > -1 && hasta > desde) {
    contenido = contenido.slice(0, desde) + bloque + contenido.slice(hasta + fin.length + 1);
  } else {
    contenido = contenido.trimEnd() + '\n\n' + bloque;
  }

  writeFileSync(ruta, contenido.replace(/\n{3,}/g, '\n\n'), 'utf-8');
}
