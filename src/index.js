/**
 * =====================================================================
 *  Catálogo de Videojuegos — Servicio REST
 *  Cloudflare Workers (FaaS) + Cloudflare D1
 * =====================================================================
 *
 *  Entidad principal : /api/juegos
 *  Entidades sec.    : /api/estudios · /api/plataformas
 *
 *  Convenciones RESTful implementadas:
 *    GET    /api/<recurso>        -> lista (filtros + paginación)
 *    GET    /api/<recurso>/:id    -> consulta individual
 *    POST   /api/<recurso>        -> crea (201 + cabecera Location)
 *    PUT    /api/<recurso>/:id    -> reemplaza el registro completo
 *    PATCH  /api/<recurso>/:id    -> modifica campos puntuales
 *    DELETE /api/<recurso>/:id    -> elimina (204 sin contenido)
 *
 *  Navegación entre entidades:
 *    GET /api/estudios/:id/juegos
 *    GET /api/plataformas/:id/juegos
 * =====================================================================
 */

/* ------------------------------------------------------------------ */
/*  Utilidades HTTP                                                    */
/* ------------------------------------------------------------------ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
      ...extraHeaders,
    },
  });
}

function sinContenido() {
  return new Response(null, { status: 204, headers: CORS });
}

function error(status, mensaje, detalles) {
  const cuerpo = { error: true, estado: status, mensaje };
  if (detalles) cuerpo.detalles = detalles;
  return json(cuerpo, status);
}

async function leerCuerpo(request) {
  const tipo = request.headers.get('Content-Type') || '';
  if (!tipo.includes('application/json')) {
    throw new RespuestaError(415, 'El cuerpo debe enviarse como application/json.');
  }
  try {
    const cuerpo = await request.json();
    if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
      throw new Error('no es objeto');
    }
    return cuerpo;
  } catch {
    throw new RespuestaError(400, 'El cuerpo de la petición no es un objeto JSON válido.');
  }
}

class RespuestaError extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

/* ------------------------------------------------------------------ */
/*  Definición de las entidades                                        */
/* ------------------------------------------------------------------ */

const ENTIDADES = {
  juegos: {
    tabla: 'juegos',
    etiqueta: 'juego',
    ordenPorDefecto: 'titulo',
    ordenables: ['id', 'titulo', 'anio', 'calificacion', 'precio', 'creado_en'],
    buscarEn: ['titulo', 'genero', 'descripcion'],
    campos: {
      titulo:        { tipo: 'texto',   requerido: true,  max: 160 },
      anio:          { tipo: 'entero',  requerido: true,  min: 1958, max: 2100 },
      genero:        { tipo: 'texto',   requerido: true,  max: 80 },
      calificacion:  { tipo: 'entero',  requerido: false, min: 0, max: 100 },
      precio:        { tipo: 'decimal', requerido: false, min: 0, max: 100000 },
      descripcion:   { tipo: 'texto',   requerido: false, max: 2000 },
      imagen:        { tipo: 'texto',   requerido: false, max: 500 },
      estudio_id:    { tipo: 'entero',  requerido: false, referencia: 'estudios' },
      plataforma_id: { tipo: 'entero',  requerido: false, referencia: 'plataformas' },
    },
  },
  estudios: {
    tabla: 'estudios',
    etiqueta: 'estudio',
    ordenPorDefecto: 'nombre',
    ordenables: ['id', 'nombre', 'pais', 'anio_fundacion', 'creado_en'],
    buscarEn: ['nombre', 'pais', 'fundador', 'descripcion'],
    campos: {
      nombre:         { tipo: 'texto',  requerido: true,  max: 160 },
      pais:           { tipo: 'texto',  requerido: true,  max: 80 },
      anio_fundacion: { tipo: 'entero', requerido: true,  min: 1900, max: 2100 },
      fundador:       { tipo: 'texto',  requerido: false, max: 160 },
      sitio_web:      { tipo: 'texto',  requerido: false, max: 300 },
      descripcion:    { tipo: 'texto',  requerido: false, max: 2000 },
      imagen:         { tipo: 'texto',  requerido: false, max: 500 },
    },
  },
  plataformas: {
    tabla: 'plataformas',
    etiqueta: 'plataforma',
    ordenPorDefecto: 'nombre',
    ordenables: ['id', 'nombre', 'fabricante', 'anio_lanzamiento', 'unidades_vendidas', 'creado_en'],
    buscarEn: ['nombre', 'fabricante', 'generacion', 'descripcion'],
    campos: {
      nombre:            { tipo: 'texto',   requerido: true,  max: 160 },
      fabricante:        { tipo: 'texto',   requerido: true,  max: 120 },
      anio_lanzamiento:  { tipo: 'entero',  requerido: true,  min: 1958, max: 2100 },
      generacion:        { tipo: 'texto',   requerido: false, max: 60 },
      unidades_vendidas: { tipo: 'decimal', requerido: false, min: 0, max: 100000 },
      descripcion:       { tipo: 'texto',   requerido: false, max: 2000 },
      imagen:            { tipo: 'texto',   requerido: false, max: 500 },
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Validación                                                         */
/* ------------------------------------------------------------------ */

function validar(entidad, datos, { parcial }) {
  const definicion = ENTIDADES[entidad].campos;
  const limpio = {};
  const fallos = [];

  for (const [campo, regla] of Object.entries(definicion)) {
    const presente = Object.prototype.hasOwnProperty.call(datos, campo);

    if (!presente) {
      if (regla.requerido && !parcial) fallos.push(`Falta el campo obligatorio "${campo}".`);
      continue;
    }

    let valor = datos[campo];

    // Un nulo explícito borra el valor, salvo en campos obligatorios.
    if (valor === null || valor === '') {
      if (regla.requerido) {
        fallos.push(`El campo "${campo}" no puede quedar vacío.`);
      } else {
        limpio[campo] = null;
      }
      continue;
    }

    if (regla.tipo === 'texto') {
      valor = String(valor).trim();
      if (!valor && regla.requerido) { fallos.push(`El campo "${campo}" no puede quedar vacío.`); continue; }
      if (regla.max && valor.length > regla.max) {
        fallos.push(`El campo "${campo}" supera los ${regla.max} caracteres.`); continue;
      }
    }

    if (regla.tipo === 'entero' || regla.tipo === 'decimal') {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) { fallos.push(`El campo "${campo}" debe ser numérico.`); continue; }
      valor = regla.tipo === 'entero' ? Math.trunc(numero) : numero;
      if (regla.min !== undefined && valor < regla.min) {
        fallos.push(`El campo "${campo}" no puede ser menor que ${regla.min}.`); continue;
      }
      if (regla.max !== undefined && valor > regla.max) {
        fallos.push(`El campo "${campo}" no puede ser mayor que ${regla.max}.`); continue;
      }
    }

    limpio[campo] = valor;
  }

  if (fallos.length) throw new RespuestaError(422, 'Los datos enviados no son válidos.', fallos);
  if (!Object.keys(limpio).length) throw new RespuestaError(400, 'No se envió ningún campo modificable.');

  return limpio;
}

/** Comprueba que las claves foráneas apunten a registros existentes. */
async function verificarReferencias(db, entidad, datos) {
  const definicion = ENTIDADES[entidad].campos;
  const fallos = [];

  for (const [campo, regla] of Object.entries(definicion)) {
    if (!regla.referencia) continue;
    const valor = datos[campo];
    if (valor === undefined || valor === null) continue;

    const tabla = ENTIDADES[regla.referencia].tabla;
    const fila = await db.prepare(`SELECT id FROM ${tabla} WHERE id = ?`).bind(valor).first();
    if (!fila) fallos.push(`No existe ningún registro de "${regla.referencia}" con id ${valor}.`);
  }

  if (fallos.length) throw new RespuestaError(409, 'Hay referencias que no existen.', fallos);
}

/* ------------------------------------------------------------------ */
/*  Consultas                                                          */
/* ------------------------------------------------------------------ */

/** SELECT de juegos con los datos de estudio y plataforma ya resueltos. */
const SELECT_JUEGOS = `
  SELECT  j.*,
          e.nombre AS estudio_nombre,
          e.pais   AS estudio_pais,
          e.imagen AS estudio_imagen,
          p.nombre     AS plataforma_nombre,
          p.fabricante AS plataforma_fabricante,
          p.imagen     AS plataforma_imagen
  FROM juegos j
  LEFT JOIN estudios    e ON e.id = j.estudio_id
  LEFT JOIN plataformas p ON p.id = j.plataforma_id
`;

/** Convierte una fila plana en un objeto con relaciones anidadas. */
function formatear(entidad, fila) {
  if (!fila) return fila;

  if (entidad !== 'juegos') {
    return { ...fila, _enlaces: { self: `/api/${entidad}/${fila.id}`, juegos: `/api/${entidad}/${fila.id}/juegos` } };
  }

  const {
    estudio_nombre, estudio_pais, estudio_imagen,
    plataforma_nombre, plataforma_fabricante, plataforma_imagen,
    ...juego
  } = fila;

  return {
    ...juego,
    estudio: juego.estudio_id
      ? { id: juego.estudio_id, nombre: estudio_nombre, pais: estudio_pais, imagen: estudio_imagen }
      : null,
    plataforma: juego.plataforma_id
      ? { id: juego.plataforma_id, nombre: plataforma_nombre, fabricante: plataforma_fabricante, imagen: plataforma_imagen }
      : null,
    _enlaces: {
      self: `/api/juegos/${juego.id}`,
      estudio: juego.estudio_id ? `/api/estudios/${juego.estudio_id}` : null,
      plataforma: juego.plataforma_id ? `/api/plataformas/${juego.plataforma_id}` : null,
    },
  };
}

async function listar(db, entidad, url) {
  const cfg = ENTIDADES[entidad];
  const params = url.searchParams;

  const condiciones = [];
  const valores = [];

  // Búsqueda de texto libre
  const buscar = (params.get('buscar') || '').trim();
  if (buscar) {
    const prefijo = entidad === 'juegos' ? 'j.' : '';
    const like = cfg.buscarEn.map((c) => `${prefijo}${c} LIKE ?`).join(' OR ');
    condiciones.push(`(${like})`);
    cfg.buscarEn.forEach(() => valores.push(`%${buscar}%`));
  }

  // Filtros por relación y por campo
  for (const filtro of ['estudio_id', 'plataforma_id', 'genero', 'anio', 'pais', 'fabricante']) {
    if (!cfg.campos[filtro]) continue;
    const valor = params.get(filtro);
    if (valor === null || valor === '') continue;
    const prefijo = entidad === 'juegos' ? 'j.' : '';
    condiciones.push(`${prefijo}${filtro} = ?`);
    valores.push(cfg.campos[filtro].tipo === 'texto' ? valor : Number(valor));
  }

  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';

  // Ordenamiento (sólo columnas de la lista blanca)
  let ordenar = params.get('ordenar') || cfg.ordenPorDefecto;
  if (!cfg.ordenables.includes(ordenar)) ordenar = cfg.ordenPorDefecto;
  const direccion = (params.get('direccion') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const prefijoOrden = entidad === 'juegos' ? 'j.' : '';

  // Paginación
  const limite = Math.min(Math.max(parseInt(params.get('limite') || '100', 10) || 100, 1), 200);
  const pagina = Math.max(parseInt(params.get('pagina') || '1', 10) || 1, 1);
  const salto = (pagina - 1) * limite;

  const base = entidad === 'juegos' ? SELECT_JUEGOS : `SELECT * FROM ${cfg.tabla}`;
  const tablaConteo = entidad === 'juegos' ? 'juegos j' : cfg.tabla;

  const consulta = `${base}${where} ORDER BY ${prefijoOrden}${ordenar} ${direccion} LIMIT ? OFFSET ?`;
  const { results } = await db.prepare(consulta).bind(...valores, limite, salto).all();

  const conteo = await db
    .prepare(`SELECT COUNT(*) AS total FROM ${tablaConteo}${where}`)
    .bind(...valores)
    .first();

  const total = conteo?.total ?? 0;

  return json({
    total,
    pagina,
    limite,
    paginas: Math.max(Math.ceil(total / limite), 1),
    datos: results.map((f) => formatear(entidad, f)),
  });
}

async function obtener(db, entidad, id) {
  const consulta = entidad === 'juegos'
    ? `${SELECT_JUEGOS} WHERE j.id = ?`
    : `SELECT * FROM ${ENTIDADES[entidad].tabla} WHERE id = ?`;

  const fila = await db.prepare(consulta).bind(id).first();
  if (!fila) throw new RespuestaError(404, `No existe ningún ${ENTIDADES[entidad].etiqueta} con id ${id}.`);
  return fila;
}

async function crear(db, entidad, request) {
  const cuerpo = await leerCuerpo(request);
  const datos = validar(entidad, cuerpo, { parcial: false });
  await verificarReferencias(db, entidad, datos);

  const columnas = Object.keys(datos);
  const marcadores = columnas.map(() => '?').join(', ');

  const insertado = await db
    .prepare(`INSERT INTO ${ENTIDADES[entidad].tabla} (${columnas.join(', ')}) VALUES (${marcadores}) RETURNING id`)
    .bind(...columnas.map((c) => datos[c]))
    .first();

  const fila = await obtener(db, entidad, insertado.id);
  return json(formatear(entidad, fila), 201, { Location: `/api/${entidad}/${insertado.id}` });
}

async function actualizar(db, entidad, id, request, { parcial }) {
  await obtener(db, entidad, id); // 404 si no existe

  const cuerpo = await leerCuerpo(request);
  const datos = validar(entidad, cuerpo, { parcial });
  await verificarReferencias(db, entidad, datos);

  // PUT reemplaza: los campos opcionales que no vengan se vacían.
  if (!parcial) {
    for (const [campo, regla] of Object.entries(ENTIDADES[entidad].campos)) {
      if (!regla.requerido && !(campo in datos)) datos[campo] = null;
    }
  }

  const columnas = Object.keys(datos);
  const asignaciones = columnas.map((c) => `${c} = ?`).join(', ');

  await db
    .prepare(`UPDATE ${ENTIDADES[entidad].tabla} SET ${asignaciones}, actualizado_en = datetime('now') WHERE id = ?`)
    .bind(...columnas.map((c) => datos[c]), id)
    .run();

  const fila = await obtener(db, entidad, id);
  return json(formatear(entidad, fila));
}

async function eliminar(db, entidad, id) {
  await obtener(db, entidad, id); // 404 si no existe

  // Al borrar un estudio o una plataforma, los juegos quedan huérfanos
  // en lugar de desaparecer con él.
  if (entidad === 'estudios') {
    await db.prepare('UPDATE juegos SET estudio_id = NULL WHERE estudio_id = ?').bind(id).run();
  }
  if (entidad === 'plataformas') {
    await db.prepare('UPDATE juegos SET plataforma_id = NULL WHERE plataforma_id = ?').bind(id).run();
  }

  await db.prepare(`DELETE FROM ${ENTIDADES[entidad].tabla} WHERE id = ?`).bind(id).run();
  return sinContenido();
}

/** Juegos asociados a un estudio o a una plataforma. */
async function juegosRelacionados(db, entidad, id) {
  await obtener(db, entidad, id);
  const columna = entidad === 'estudios' ? 'j.estudio_id' : 'j.plataforma_id';
  const { results } = await db.prepare(`${SELECT_JUEGOS} WHERE ${columna} = ? ORDER BY j.anio DESC`).bind(id).all();
  return json({ total: results.length, datos: results.map((f) => formatear('juegos', f)) });
}

async function estadisticas(db) {
  const [juegos, estudios, plataformas, generos, top] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n, AVG(calificacion) AS media, MIN(anio) AS desde, MAX(anio) AS hasta FROM juegos').first(),
    db.prepare('SELECT COUNT(*) AS n FROM estudios').first(),
    db.prepare('SELECT COUNT(*) AS n FROM plataformas').first(),
    db.prepare('SELECT genero, COUNT(*) AS n FROM juegos GROUP BY genero ORDER BY n DESC').all(),
    db.prepare(`${SELECT_JUEGOS} ORDER BY j.calificacion DESC LIMIT 3`).all(),
  ]);

  return json({
    juegos: juegos.n,
    estudios: estudios.n,
    plataformas: plataformas.n,
    calificacion_media: juegos.media ? Math.round(juegos.media * 10) / 10 : null,
    rango_anios: { desde: juegos.desde, hasta: juegos.hasta },
    generos: generos.results,
    destacados: top.results.map((f) => formatear('juegos', f)),
  });
}

function indiceApi() {
  return json({
    servicio: 'Catálogo de Videojuegos',
    version: '1.0.0',
    descripcion: 'API REST sobre Cloudflare Workers y D1.',
    recursos: {
      juegos: {
        listar: 'GET /api/juegos?buscar=&genero=&estudio_id=&plataforma_id=&ordenar=&direccion=&pagina=&limite=',
        consultar: 'GET /api/juegos/:id',
        crear: 'POST /api/juegos',
        reemplazar: 'PUT /api/juegos/:id',
        modificar: 'PATCH /api/juegos/:id',
        eliminar: 'DELETE /api/juegos/:id',
      },
      estudios: {
        listar: 'GET /api/estudios',
        consultar: 'GET /api/estudios/:id',
        juegosDelEstudio: 'GET /api/estudios/:id/juegos',
        crear: 'POST /api/estudios',
        reemplazar: 'PUT /api/estudios/:id',
        modificar: 'PATCH /api/estudios/:id',
        eliminar: 'DELETE /api/estudios/:id',
      },
      plataformas: {
        listar: 'GET /api/plataformas',
        consultar: 'GET /api/plataformas/:id',
        juegosDeLaPlataforma: 'GET /api/plataformas/:id/juegos',
        crear: 'POST /api/plataformas',
        reemplazar: 'PUT /api/plataformas/:id',
        modificar: 'PATCH /api/plataformas/:id',
        eliminar: 'DELETE /api/plataformas/:id',
      },
      estadisticas: 'GET /api/estadisticas',
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Enrutador                                                          */
/* ------------------------------------------------------------------ */

async function enrutar(request, env) {
  const url = new URL(request.url);
  const db = env.DB;

  if (!db) throw new RespuestaError(500, 'La base de datos D1 no está enlazada. Revisa el binding "DB" en wrangler.toml.');

  // /api/juegos/3/... -> ['api', 'juegos', '3']
  const partes = url.pathname.split('/').filter(Boolean);
  partes.shift(); // quita 'api'

  const [entidad, idBruto, subrecurso] = partes;
  const metodo = request.method.toUpperCase();

  if (!entidad) return indiceApi();
  if (entidad === 'estadisticas') {
    if (metodo !== 'GET') throw new RespuestaError(405, `El método ${metodo} no está permitido en este recurso.`);
    return estadisticas(db);
  }
  if (!ENTIDADES[entidad]) throw new RespuestaError(404, `El recurso "${entidad}" no existe. Disponibles: juegos, estudios, plataformas.`);

  /* ---- Colección: /api/<entidad> ---- */
  if (!idBruto) {
    if (metodo === 'GET') return listar(db, entidad, url);
    if (metodo === 'POST') return crear(db, entidad, request);
    throw new RespuestaError(405, `El método ${metodo} no está permitido sobre la colección.`);
  }

  const id = Number(idBruto);
  if (!Number.isInteger(id) || id < 1) throw new RespuestaError(400, `"${idBruto}" no es un identificador válido.`);

  /* ---- Subrecurso: /api/<entidad>/:id/juegos ---- */
  if (subrecurso) {
    if (subrecurso !== 'juegos' || entidad === 'juegos') {
      throw new RespuestaError(404, `La ruta ${url.pathname} no existe.`);
    }
    if (metodo !== 'GET') throw new RespuestaError(405, `El método ${metodo} no está permitido en este recurso.`);
    return juegosRelacionados(db, entidad, id);
  }

  /* ---- Registro individual ---- */
  switch (metodo) {
    case 'GET':    return json(formatear(entidad, await obtener(db, entidad, id)));
    case 'PUT':    return actualizar(db, entidad, id, request, { parcial: false });
    case 'PATCH':  return actualizar(db, entidad, id, request, { parcial: true });
    case 'DELETE': return eliminar(db, entidad, id);
    default:       throw new RespuestaError(405, `El método ${metodo} no está permitido sobre este registro.`);
  }
}

/* ------------------------------------------------------------------ */
/*  Punto de entrada                                                   */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Todo lo que no sea /api lo resuelven los archivos estáticos.
    if (!url.pathname.startsWith('/api')) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      return await enrutar(request, env);
    } catch (e) {
      if (e instanceof RespuestaError) return error(e.estado, e.message, e.detalles);
      console.error(e);
      return error(500, 'Error interno del servicio.', [String(e?.message || e)]);
    }
  },
};
