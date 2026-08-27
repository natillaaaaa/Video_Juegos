#!/usr/bin/env node
/**
 * =====================================================================
 *  Busca la portada real de cada juego del catálogo en la API de RAWG
 *  y deja las direcciones listas para aplicar.
 *
 *  Uso:
 *    node scripts/portadas.mjs --clave TU_CLAVE_RAWG
 *        → genera portadas.sql con las sentencias UPDATE
 *
 *    node scripts/portadas.mjs --clave TU_CLAVE_RAWG --aplicar
 *        → además las guarda directamente por PATCH contra tu servicio
 *
 *  Opciones:
 *    --clave    clave de https://rawg.io/apidocs (gratuita)
 *    --sitio    URL de tu servicio; por defecto la publicada
 *    --aplicar  guarda los cambios en vez de sólo escribir el SQL
 *
 *  Las imágenes son propiedad de sus respectivas editoras. RAWG las
 *  sirve desde su CDN y pide que se le acredite como fuente de datos.
 * =====================================================================
 */

import { writeFileSync } from 'node:fs';

/* ------------------------------ Argumentos ------------------------------ */

function argumento(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : porDefecto;
}

const CLAVE = argumento('clave', process.env.RAWG_API_KEY);
const SITIO = argumento('sitio', 'https://catalogo-videojuegos.nathali504530912.workers.dev').replace(/\/$/, '');
const APLICAR = process.argv.includes('--aplicar');

if (!CLAVE) {
  console.error('\nFalta la clave de RAWG.\n');
  console.error('  1. Entra en https://rawg.io/apidocs y crea una cuenta gratuita.');
  console.error('  2. Copia la clave que te dan.');
  console.error('  3. Ejecuta:  node scripts/portadas.mjs --clave TU_CLAVE\n');
  process.exit(1);
}

/**
 * Algunos títulos están en español en la base de datos. RAWG los indexa
 * en inglés, así que aquí se indica con qué nombre buscarlos.
 */
const NOMBRE_EN_RAWG = {
  'The Legend of Zelda: Ocarina of Time': 'The Legend of Zelda: Ocarina of Time',
  'Uncharted 4: El desenlace del ladrón': 'Uncharted 4: A Thief\'s End',
  'Jak and Daxter: El legado de los precursores': 'Jak and Daxter: The Precursor Legacy',
  'Grand Theft Auto: San Andreas': 'Grand Theft Auto: San Andreas',
};

/* ------------------------------ Utilidades ------------------------------ */

/** Quita acentos, signos y mayúsculas para poder comparar dos títulos. */
function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Puntúa cuánto se parece un resultado de RAWG al juego que buscamos. */
function puntuar(candidato, buscado, anio) {
  const a = normalizar(candidato.name);
  const b = normalizar(buscado);
  let puntos = 0;

  if (a === b) puntos += 100;
  else if (a.startsWith(b) || b.startsWith(a)) puntos += 60;
  else if (a.includes(b) || b.includes(a)) puntos += 35;

  const anioCandidato = candidato.released ? Number(candidato.released.slice(0, 4)) : null;
  if (anioCandidato && anio) {
    const distancia = Math.abs(anioCandidato - anio);
    if (distancia === 0) puntos += 25;
    else if (distancia <= 2) puntos += 10;
    else puntos -= distancia;
  }

  if (!candidato.background_image) puntos -= 1000; // sin imagen no sirve
  return puntos;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ Proceso ------------------------------ */

async function leerCatalogo() {
  const respuesta = await fetch(`${SITIO}/api/juegos?limite=200&ordenar=id`);
  if (!respuesta.ok) throw new Error(`El servicio respondió ${respuesta.status} al leer el catálogo.`);
  const { datos } = await respuesta.json();
  return datos;
}

async function buscarPortada(juego) {
  const consulta = NOMBRE_EN_RAWG[juego.titulo] || juego.titulo;
  const url = new URL('https://api.rawg.io/api/games');
  url.searchParams.set('key', CLAVE);
  url.searchParams.set('search', consulta);
  url.searchParams.set('page_size', '8');

  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`RAWG respondió ${respuesta.status}`);

  const { results = [] } = await respuesta.json();
  if (!results.length) return null;

  const mejor = results
    .map((c) => ({ ...c, puntos: puntuar(c, consulta, juego.anio) }))
    .sort((x, y) => y.puntos - x.puntos)[0];

  // Por debajo de este umbral la coincidencia es dudosa: mejor no tocarla.
  if (!mejor || mejor.puntos < 30) return null;

  return { url: mejor.background_image, nombre: mejor.name, anio: mejor.released?.slice(0, 4) };
}

async function guardar(juego, direccion) {
  const respuesta = await fetch(`${SITIO}/api/juegos/${juego.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagen: direccion }),
  });
  if (!respuesta.ok) throw new Error(`PATCH devolvió ${respuesta.status}`);
}

async function principal() {
  console.log(`\nLeyendo el catálogo de ${SITIO} …`);
  const juegos = await leerCatalogo();
  console.log(`${juegos.length} juegos encontrados.\n`);

  const sentencias = [];
  let encontradas = 0;
  let sinCoincidencia = 0;

  for (const juego of juegos) {
    try {
      const portada = await buscarPortada(juego);

      if (!portada) {
        console.log(`  ·  ${juego.titulo} — sin coincidencia clara, se deja la imagen actual`);
        sinCoincidencia += 1;
      } else {
        const escapada = portada.url.replace(/'/g, "''");
        sentencias.push(`UPDATE juegos SET imagen = '${escapada}' WHERE id = ${juego.id}; -- ${portada.nombre}`);
        encontradas += 1;

        if (APLICAR) {
          await guardar(juego, portada.url);
          console.log(`  ✓  ${juego.titulo} — guardada (${portada.nombre}, ${portada.anio})`);
        } else {
          console.log(`  ✓  ${juego.titulo} — ${portada.nombre} (${portada.anio})`);
        }
      }
    } catch (e) {
      console.log(`  ✕  ${juego.titulo} — ${e.message}`);
      sinCoincidencia += 1;
    }

    await esperar(350); // RAWG limita las peticiones por segundo
  }

  if (sentencias.length) {
    const cabecera = [
      '-- Portadas obtenidas de la API de RAWG (https://rawg.io).',
      '-- Las imágenes pertenecen a sus respectivas editoras.',
      `-- Generado el ${new Date().toISOString().slice(0, 10)}.`,
      '',
    ].join('\n');
    writeFileSync('portadas.sql', cabecera + sentencias.join('\n') + '\n', 'utf-8');
  }

  console.log(`\n${encontradas} portadas encontradas, ${sinCoincidencia} sin cambios.`);

  if (APLICAR) {
    console.log('Ya están guardadas en la base de datos. Recarga el sitio para verlas.\n');
  } else if (sentencias.length) {
    console.log('\nSe escribió portadas.sql. Para aplicarlo:');
    console.log('  npx wrangler d1 execute catalogo-videojuegos --remote --file=./portadas.sql\n');
  }
}

principal().catch((e) => {
  console.error('\nError:', e.message, '\n');
  process.exit(1);
});
