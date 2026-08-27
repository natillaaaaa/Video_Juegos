-- =====================================================================
--  Catálogo de Videojuegos — Esquema de base de datos
--  Compatible con SQLite y Cloudflare D1
--
--  Entidad principal : juegos          (18 registros)
--  Entidad secundaria: estudios        (6 registros)
--  Entidad secundaria: plataformas     (6 registros)
--
--  Relación: juegos.estudio_id    -> estudios.id     (N:1)
--            juegos.plataforma_id -> plataformas.id  (N:1)
-- =====================================================================

DROP TABLE IF EXISTS juegos;
DROP TABLE IF EXISTS estudios;
DROP TABLE IF EXISTS plataformas;

-- ---------------------------------------------------------------------
-- Entidad secundaria 1: ESTUDIOS (desarrolladores)
-- ---------------------------------------------------------------------
CREATE TABLE estudios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  pais          TEXT    NOT NULL,
  anio_fundacion INTEGER NOT NULL,
  fundador      TEXT,
  sitio_web     TEXT,
  descripcion   TEXT,
  imagen        TEXT,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT
);

-- ---------------------------------------------------------------------
-- Entidad secundaria 2: PLATAFORMAS (consolas / sistemas)
-- ---------------------------------------------------------------------
CREATE TABLE plataformas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT    NOT NULL,
  fabricante       TEXT    NOT NULL,
  anio_lanzamiento INTEGER NOT NULL,
  generacion       TEXT,
  unidades_vendidas REAL,          -- en millones de unidades
  descripcion      TEXT,
  imagen           TEXT,
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en   TEXT
);

-- ---------------------------------------------------------------------
-- Entidad principal: JUEGOS
-- ---------------------------------------------------------------------
CREATE TABLE juegos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo        TEXT    NOT NULL,
  anio          INTEGER NOT NULL,
  genero        TEXT    NOT NULL,
  calificacion  INTEGER,           -- puntaje 0-100
  precio        REAL,              -- en USD
  descripcion   TEXT,
  imagen        TEXT,
  estudio_id    INTEGER REFERENCES estudios(id)    ON DELETE SET NULL,
  plataforma_id INTEGER REFERENCES plataformas(id) ON DELETE SET NULL,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT
);

CREATE INDEX idx_juegos_estudio    ON juegos(estudio_id);
CREATE INDEX idx_juegos_plataforma ON juegos(plataforma_id);
CREATE INDEX idx_juegos_titulo     ON juegos(titulo);
