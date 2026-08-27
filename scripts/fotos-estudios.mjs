#!/usr/bin/env node
/**
 * =====================================================================
 *  Descarga una fotografía de licencia libre para cada estudio desde
 *  Wikimedia Commons y actualiza el catálogo.
 *
 *  Los logotipos corporativos son marcas registradas, así que el script
 *  no los usa. En su lugar busca, por este orden:
 *    1. la sede del estudio,
 *    2. la ciudad donde tiene su sede,
 *    3. el país que figura en la base de datos.
 *
 *  Uso:
 *    node scripts/fotos-estudios.mjs
 *        → descarga las fotos y muestra qué encontró, sin tocar la base
 *
 *    node scripts/fotos-estudios.mjs --aplicar
 *        → además guarda las rutas por PATCH contra tu servicio
 * =====================================================================
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardarSeccion } from './creditos.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'public/img/estudios');

function argumento(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : porDefecto;
}

const SITIO = argumento('sitio', 'https://catalogo-videojuegos.nathali504530912.workers.dev').replace(/\/$/, '');
const APLICAR = process.argv.includes('--aplicar');

/**
 * Búsquedas por estudio, de la más específica a la más general.
 * Si un estudio no aparece aquí se usa su país como último recurso.
 */
const BUSQUEDAS = {
  'Nintendo EPD':      ['Nintendo headquarters Kyoto', 'Kyoto Japan cityscape'],
  'Rockstar Games':    ['Rockstar Games office New York', 'Broadway Manhattan New York City'],
  'FromSoftware':      ['FromSoftware Tokyo office', 'Shinjuku Tokyo skyline'],
  'Valve Corporation': ['Valve Corporation headquarters Bellevue', 'Bellevue Washington downtown'],
  'CD Projekt Red':    ['CD Projekt headquarters Warsaw', 'Warsaw Poland skyline'],
  'Naughty Dog':       ['Naughty Dog Santa Monica', 'Santa Monica California city'],
};

const LICENCIAS_LIBRES = /^(cc0|public domain|pd|cc by|cc by-sa|cc-by)/i;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ Commons ------------------------------ */

async function buscarEnCommons(consulta) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${consulta} filetype:bitmap`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '1200');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const respuesta = await fetch(url, { headers: { 'User-Agent': 'CatalogoVideojuegos/1.0 (proyecto academico)' } });
  if (!respuesta.ok) throw new Error(`Commons respondió ${respuesta.status}`);

  const datos = await respuesta.json();
  return Object.values(datos?.query?.pages ?? {});
}

function evaluar(pagina, consulta) {
  const info = pagina.imageinfo?.[0];
  if (!info) return null;

  if (!/^image\/(jpeg|png)$/.test(info.mime || '')) return null;
  // Fuera logotipos, marcas y material que no es fotografía.
  if (/logo|wordmark|icon|emblem|diagram|chart|map|font|screenshot|box ?art|cover/i.test(pagina.title)) return null;
  if ((info.width || 0) < 800) return null;
  // Las fotos apaisadas encajan mejor en las tarjetas.
  if (info.height && info.width && info.width / info.height < 1.1) return null;

  const meta = info.extmetadata || {};
  const licencia = (meta.LicenseShortName?.value || '').trim();
  if (!LICENCIAS_LIBRES.test(licencia)) return null;

  const titulo = pagina.title.toLowerCase();
  const palabras = consulta.toLowerCase().split(/\s+/).filter((p) => p.length > 3);
  let puntos = palabras.reduce((n, p) => n + (titulo.includes(p) ? 20 : 0), 0);

  if (/^(cc0|public domain|pd)/i.test(licencia)) puntos += 15;
  if ((info.width || 0) >= 1600) puntos += 5;
  if (/building|headquarters|office|skyline|downtown|street/i.test(titulo)) puntos += 10;

  return {
    puntos,
    titulo: pagina.title.replace(/^File:/, ''),
    descarga: info.thumburl || info.url,
    licencia,
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

async function leerEstudios() {
  const respuesta = await fetch(`${SITIO}/api/estudios?limite=200&ordenar=id`);
  if (!respuesta.ok) throw new Error(`El servicio respondió ${respuesta.status} al leer los estudios.`);
  const { datos } = await respuesta.json();
  return datos;
}

async function guardar(id, ruta) {
  const respuesta = await fetch(`${SITIO}/api/estudios/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagen: ruta }),
  });
  if (!respuesta.ok) throw new Error(`PATCH devolvió ${respuesta.status}`);
}

/** Prueba cada búsqueda por orden hasta encontrar una foto aceptable. */
async function mejorFoto(estudio) {
  const consultas = BUSQUEDAS[estudio.nombre] || [`${estudio.nombre} office`, `${estudio.pais} cityscape`];

  for (const consulta of consultas) {
    const paginas = await buscarEnCommons(consulta);
    const candidata = paginas
      .map((p) => evaluar(p, consulta))
      .filter(Boolean)
      .sort((a, b) => b.puntos - a.puntos)[0];

    if (candidata && candidata.puntos >= 20) return { ...candidata, consulta };
    await esperar(300);
  }
  return null;
}

async function principal() {
  mkdirSync(DESTINO, { recursive: true });

  console.log(`\nLeyendo los estudios de ${SITIO} …`);
  const estudios = await leerEstudios();
  console.log(`${estudios.length} estudios encontrados.\n`);

  const creditos = [];
  let logrados = 0;

  for (const estudio of estudios) {
    try {
      const foto = await mejorFoto(estudio);

      if (!foto) {
        console.log(`  ·  ${estudio.nombre} — sin foto libre adecuada, se deja el emblema`);
        continue;
      }

      const extension = foto.descarga.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const archivo = `${estudio.id}.${extension}`;
      const peso = await descargar(foto.descarga, resolve(DESTINO, archivo));
      const ruta = `/img/estudios/${archivo}`;

      creditos.push({ estudio: estudio.nombre, ...foto, archivo });
      logrados += 1;

      const resumen = `${archivo} (${Math.round(peso / 1024)} KB, ${foto.licencia}) — ${foto.consulta}`;
      if (APLICAR) {
        await guardar(estudio.id, ruta);
        console.log(`  ✓  ${estudio.nombre} — ${resumen}`);
      } else {
        console.log(`  ✓  ${estudio.nombre} — ${resumen}`);
      }
    } catch (e) {
      console.log(`  ✕  ${estudio.nombre} — ${e.message}`);
    }

    await esperar(400);
  }

  if (creditos.length) {
    guardarSeccion(resolve(RAIZ, 'CREDITOS-IMAGENES.md'), 'estudios', [
      '## Estudios',
      '',
      'Fotografías de sedes y ciudades procedentes de Wikimedia Commons. No se',
      'utilizan logotipos corporativos, por tratarse de marcas registradas.',
      '',
      '| Estudio | Archivo | Autor | Licencia | Origen |',
      '|---|---|---|---|---|',
      ...creditos.map((c) =>
        `| ${c.estudio} | \`${c.archivo}\` | ${c.autor} | ${c.licencia} | [Commons](${c.pagina}) |`
      ),
    ]);
  }

  console.log(`\n${logrados} de ${estudios.length} estudios con foto nueva.`);
  if (creditos.length) console.log('Créditos actualizados en CREDITOS-IMAGENES.md.');

  if (APLICAR) {
    console.log('\nLas rutas ya están en la base de datos. Publica para subir las fotos:');
    console.log('  npx wrangler deploy\n');
  } else if (logrados) {
    console.log('\nLas fotos están descargadas pero la base todavía apunta a los emblemas.');
    console.log('Vuelve a ejecutar con --aplicar cuando te convenzan.\n');
  }
}

principal().catch((e) => {
  console.error('\nError:', e.message, '\n');
  process.exit(1);
});
