#!/usr/bin/env node
/**
 * =====================================================================
 *  Descarga una foto de licencia libre para cada plataforma desde
 *  Wikimedia Commons, la guarda en public/img/plataformas/ y actualiza
 *  el catálogo.
 *
 *  Uso:
 *    node scripts/fotos-plataformas.mjs
 *        → descarga las fotos y muestra qué encontró, sin tocar la base
 *
 *    node scripts/fotos-plataformas.mjs --aplicar
 *        → además guarda las rutas por PATCH contra tu servicio
 *
 *  Opciones:
 *    --sitio    URL de tu servicio; por defecto la publicada
 *    --aplicar  guarda los cambios en la base de datos
 *
 *  Sólo se aceptan archivos en dominio público o con licencia Creative
 *  Commons. Los créditos quedan registrados en CREDITOS-IMAGENES.md.
 * =====================================================================
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardarSeccion } from './creditos.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'public/img/plataformas');

function argumento(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : porDefecto;
}

const SITIO = argumento('sitio', 'https://catalogo-videojuegos.nathali504530912.workers.dev').replace(/\/$/, '');
const APLICAR = process.argv.includes('--aplicar');

/**
 * Términos de búsqueda en Commons. Sin entrada aquí se busca por el
 * nombre de la plataforma tal cual está en la base de datos.
 */
const BUSQUEDA = {
  'PlayStation 5': 'PlayStation 5 console',
  'Xbox Series X': 'Xbox Series X console',
  'Nintendo Switch': 'Nintendo Switch console',
  'PC': 'Gaming desktop computer',
  'PlayStation 2': 'PlayStation 2 console',
  'Nintendo 64': 'Nintendo 64 console',
  'Nintendo GameCube': 'Nintendo GameCube console',
  'Sega Genesis': 'Sega Genesis console',
  'Steam Deck': 'Steam Deck handheld',
};

/** Licencias que permiten reutilizar la imagen. */
const LICENCIAS_LIBRES = /^(cc0|public domain|pd|cc by|cc by-sa|cc-by)/i;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ Commons ------------------------------ */

async function buscarEnCommons(consulta) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${consulta} filetype:bitmap`);
  url.searchParams.set('gsrnamespace', '6');       // sólo archivos
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '1000');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const respuesta = await fetch(url, { headers: { 'User-Agent': 'CatalogoVideojuegos/1.0 (proyecto academico)' } });
  if (!respuesta.ok) throw new Error(`Commons respondió ${respuesta.status}`);

  const datos = await respuesta.json();
  return Object.values(datos?.query?.pages ?? {});
}

/** Decide si un archivo sirve y cuánto encaja con lo que buscamos. */
function evaluar(pagina, consulta) {
  const info = pagina.imageinfo?.[0];
  if (!info) return null;

  // Sólo fotografías, nada de logos ni diagramas vectoriales.
  if (!/^image\/(jpeg|png)$/.test(info.mime || '')) return null;
  if (/logo|wordmark|icon|diagram|chart|map|font/i.test(pagina.title)) return null;
  if ((info.width || 0) < 640) return null;

  const meta = info.extmetadata || {};
  const licencia = meta.LicenseShortName?.value || '';
  if (!LICENCIAS_LIBRES.test(licencia.trim())) return null;

  // Puntuación: cuántas palabras de la búsqueda aparecen en el título.
  const titulo = pagina.title.toLowerCase();
  const palabras = consulta.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  let puntos = palabras.reduce((n, p) => n + (titulo.includes(p) ? 20 : 0), 0);

  if (/^(cc0|public domain|pd)/i.test(licencia)) puntos += 15; // sin exigencia de crédito
  if ((info.width || 0) >= 1200) puntos += 5;
  if (/console|system|hardware/i.test(titulo)) puntos += 8;

  return {
    puntos,
    titulo: pagina.title.replace(/^File:/, ''),
    descarga: info.thumburl || info.url,
    licencia: licencia.trim(),
    autor: (meta.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'Desconocido',
    pagina: info.descriptionurl,
  };
}

async function descargar(direccion, ruta) {
  const respuesta = await fetch(direccion, { headers: { 'User-Agent': 'CatalogoVideojuegos/1.0 (proyecto academico)' } });
  if (!respuesta.ok) throw new Error(`la descarga devolvió ${respuesta.status}`);
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  writeFileSync(ruta, bytes);
  return bytes.length;
}

/* ------------------------------ Proceso ------------------------------ */

async function leerPlataformas() {
  const respuesta = await fetch(`${SITIO}/api/plataformas?limite=200&ordenar=id`);
  if (!respuesta.ok) throw new Error(`El servicio respondió ${respuesta.status} al leer las plataformas.`);
  const { datos } = await respuesta.json();
  return datos;
}

async function guardar(id, ruta) {
  const respuesta = await fetch(`${SITIO}/api/plataformas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagen: ruta }),
  });
  if (!respuesta.ok) throw new Error(`PATCH devolvió ${respuesta.status}`);
}

async function principal() {
  mkdirSync(DESTINO, { recursive: true });

  console.log(`\nLeyendo las plataformas de ${SITIO} …`);
  const plataformas = await leerPlataformas();
  console.log(`${plataformas.length} plataformas encontradas.\n`);

  const creditos = [];
  let logradas = 0;

  for (const plataforma of plataformas) {
    const consulta = BUSQUEDA[plataforma.nombre] || `${plataforma.nombre} console`;

    try {
      const paginas = await buscarEnCommons(consulta);
      const mejor = paginas
        .map((p) => evaluar(p, consulta))
        .filter(Boolean)
        .sort((a, b) => b.puntos - a.puntos)[0];

      if (!mejor || mejor.puntos < 20) {
        console.log(`  ·  ${plataforma.nombre} — sin foto libre adecuada, se deja la imagen actual`);
        continue;
      }

      const extension = mejor.descarga.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const archivo = `${plataforma.id}.${extension}`;
      const peso = await descargar(mejor.descarga, resolve(DESTINO, archivo));
      const ruta = `/img/plataformas/${archivo}`;

      creditos.push({ plataforma: plataforma.nombre, ...mejor, archivo });
      logradas += 1;

      if (APLICAR) {
        await guardar(plataforma.id, ruta);
        console.log(`  ✓  ${plataforma.nombre} — ${archivo} guardado (${Math.round(peso / 1024)} KB, ${mejor.licencia})`);
      } else {
        console.log(`  ✓  ${plataforma.nombre} — ${archivo} descargado (${Math.round(peso / 1024)} KB, ${mejor.licencia})`);
      }
    } catch (e) {
      console.log(`  ✕  ${plataforma.nombre} — ${e.message}`);
    }

    await esperar(400); // no saturar la API de Commons
  }

  if (creditos.length) {
    guardarSeccion(resolve(RAIZ, 'CREDITOS-IMAGENES.md'), 'plataformas', [
      '## Plataformas',
      '',
      'Fotografías de hardware procedentes de Wikimedia Commons.',
      '',
      '| Plataforma | Archivo | Autor | Licencia | Origen |',
      '|---|---|---|---|---|',
      ...creditos.map((c) =>
        `| ${c.plataforma} | \`${c.archivo}\` | ${c.autor} | ${c.licencia} | [Commons](${c.pagina}) |`
      ),
    ]);
  }

  console.log(`\n${logradas} de ${plataformas.length} plataformas con foto nueva.`);

  if (creditos.length) console.log('Créditos escritos en CREDITOS-IMAGENES.md.');

  if (APLICAR) {
    console.log('\nLas rutas ya están en la base de datos. Publica para subir las fotos:');
    console.log('  npx wrangler deploy\n');
  } else if (logradas) {
    console.log('\nLas fotos están descargadas pero la base todavía apunta a los emblemas.');
    console.log('Vuelve a ejecutar con --aplicar cuando te convenzan.\n');
  }
}

principal().catch((e) => {
  console.error('\nError:', e.message, '\n');
  process.exit(1);
});
