/* =====================================================================
   Utilidades compartidas por los tres frontends
   ===================================================================== */

const API_BASE = '/api';

/* ---------------------------------------------------------------- */
/*  Indicador de progreso                                            */
/* ---------------------------------------------------------------- */
const Progreso = {
  activas: 0,
  barra: null,
  inicio() {
    if (!this.barra) {
      this.barra = document.createElement('div');
      this.barra.className = 'progreso';
      document.body.appendChild(this.barra);
    }
    this.activas += 1;
    this.barra.classList.remove('hecho');
    requestAnimationFrame(() => this.barra.classList.add('activo'));
  },
  fin() {
    this.activas = Math.max(0, this.activas - 1);
    if (this.activas === 0 && this.barra) {
      this.barra.classList.remove('activo');
      this.barra.classList.add('hecho');
      setTimeout(() => this.barra && this.barra.classList.remove('hecho'), 400);
    }
  },
};

/* ---------------------------------------------------------------- */
/*  Avisos emergentes                                                */
/* ---------------------------------------------------------------- */
function avisar(mensaje, tipo = 'ok') {
  let contenedor = document.querySelector('.avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.className = 'avisos';
    document.body.appendChild(contenedor);
  }

  const aviso = document.createElement('div');
  aviso.className = 'aviso' + (tipo === 'error' ? ' aviso--error' : '');
  aviso.setAttribute('role', 'status');
  aviso.innerHTML = '<span class="aviso__punto"></span><span></span>';
  aviso.lastElementChild.textContent = mensaje;
  contenedor.appendChild(aviso);

  setTimeout(() => {
    aviso.classList.add('saliendo');
    setTimeout(() => aviso.remove(), 320);
  }, 3600);
}

/* ---------------------------------------------------------------- */
/*  Cliente de la API REST                                           */
/* ---------------------------------------------------------------- */
class ErrorApi extends Error {
  constructor(mensaje, estado, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles || [];
  }
}

async function peticion(ruta, opciones = {}) {
  Progreso.inicio();
  try {
    const respuesta = await fetch(API_BASE + ruta, {
      ...opciones,
      headers: opciones.cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    });

    if (respuesta.status === 204) return null;

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      throw new ErrorApi(
        datos?.mensaje || `El servicio respondió con el código ${respuesta.status}.`,
        respuesta.status,
        datos?.detalles
      );
    }
    return datos;
  } catch (e) {
    if (e instanceof ErrorApi) throw e;
    throw new ErrorApi('No se pudo contactar con el servicio. Revisa tu conexión.', 0);
  } finally {
    Progreso.fin();
  }
}

const API = {
  listar: (entidad, params = {}) => {
    const q = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== '' && valor !== null && valor !== undefined) q.set(clave, valor);
    }
    const cadena = q.toString();
    return peticion(`/${entidad}${cadena ? '?' + cadena : ''}`);
  },
  obtener:    (entidad, id) => peticion(`/${entidad}/${id}`),
  juegosDe:   (entidad, id) => peticion(`/${entidad}/${id}/juegos`),
  crear:      (entidad, cuerpo) => peticion(`/${entidad}`, { method: 'POST', cuerpo }),
  reemplazar: (entidad, id, cuerpo) => peticion(`/${entidad}/${id}`, { method: 'PUT', cuerpo }),
  modificar:  (entidad, id, cuerpo) => peticion(`/${entidad}/${id}`, { method: 'PATCH', cuerpo }),
  eliminar:   (entidad, id) => peticion(`/${entidad}/${id}`, { method: 'DELETE' }),
  estadisticas: () => peticion('/estadisticas'),
};

/* ---------------------------------------------------------------- */
/*  Ayudas de formato                                                */
/* ---------------------------------------------------------------- */
const Formato = {
  precio: (v) => (v === null || v === undefined || v === '' ? '—' : `$${Number(v).toFixed(2)}`),
  numero: (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CR')),
  millones: (v) => (!v ? '—' : `${Number(v).toLocaleString('es-CR')} M`),
  fecha: (v) => {
    if (!v) return '—';
    const d = new Date(v.replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  texto: (v) => (v === null || v === undefined || v === '' ? '—' : v),
};

/** Retrasa la ejecución mientras el usuario sigue escribiendo. */
function retardar(fn, ms = 320) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
}

/** Lee un parámetro de la barra de direcciones. */
function parametroUrl(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

/* ---------------------------------------------------------------- */
/*  Cabecera: menú móvil y marcado de la sección activa              */
/* ---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const boton = document.querySelector('.menu-boton');
  const nav = document.querySelector('.nav');
  if (boton && nav) {
    boton.addEventListener('click', () => nav.classList.toggle('abierto'));
  }

  const actual = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach((enlace) => {
    if (enlace.getAttribute('href') === actual) enlace.classList.add('activo');
  });
});

/** Sustituye una imagen rota por un panel con la inicial del título. */
function imagenAlterna(evento, titulo = '?') {
  const img = evento.target;
  if (img.dataset.alterna) return;
  img.dataset.alterna = '1';
  const inicial = String(titulo).trim().charAt(0).toUpperCase() || '?';
  img.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
         <rect width="300" height="400" fill="#0a0d0a"/>
         <text x="150" y="230" text-anchor="middle" font-family="sans-serif"
               font-size="150" font-weight="800" fill="#76b900" opacity="0.5">${inicial}</text>
       </svg>`
    );
}
