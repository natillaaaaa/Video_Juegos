-- =====================================================================
--  Catálogo de Videojuegos — Datos iniciales
--  6 estudios · 6 plataformas · 18 juegos
-- =====================================================================

DELETE FROM juegos;
DELETE FROM estudios;
DELETE FROM plataformas;
DELETE FROM sqlite_sequence WHERE name IN ('juegos','estudios','plataformas');

-- ------------------------------ ESTUDIOS ------------------------------
INSERT INTO estudios (id, nombre, pais, anio_fundacion, fundador, sitio_web, descripcion, imagen) VALUES
(1,'Nintendo EPD','Japón',2015,'Shinya Takahashi','https://www.nintendo.com',
 'División interna de Nintendo nacida de la fusión de EAD y SPD. Responsable de las sagas Mario, Zelda y Splatoon en la era Switch.',
 '/img/estudios/1.svg'),
(2,'Rockstar Games','Estados Unidos',1998,'Sam Houser','https://www.rockstargames.com',
 'Editora y desarrolladora con sede en Nueva York, conocida por mundos abiertos de gran escala y por la saga Grand Theft Auto.',
 '/img/estudios/2.svg'),
(3,'FromSoftware','Japón',1986,'Naotoshi Zin','https://www.fromsoftware.jp',
 'Estudio de Tokio que definió el subgénero soulslike con combate exigente, diseño de niveles entrelazado y narrativa ambiental.',
 '/img/estudios/3.svg'),
(4,'Valve Corporation','Estados Unidos',1996,'Gabe Newell','https://www.valvesoftware.com',
 'Creadores de Half-Life y Portal, y operadores de Steam, la mayor tienda digital de videojuegos para PC.',
 '/img/estudios/4.svg'),
(5,'CD Projekt Red','Polonia',2002,'Marcin Iwiński','https://www.cdprojektred.com',
 'Estudio de Varsovia especializado en RPG de mundo abierto con narrativa ramificada, autor de The Witcher y Cyberpunk 2077.',
 '/img/estudios/5.svg'),
(6,'Naughty Dog','Estados Unidos',1984,'Andy Gavin y Jason Rubin','https://www.naughtydog.com',
 'Estudio de Santa Mónica propiedad de Sony. Referente en narrativa cinematográfica y captura de actuación.',
 '/img/estudios/6.svg');

-- ----------------------------- PLATAFORMAS ----------------------------
INSERT INTO plataformas (id, nombre, fabricante, anio_lanzamiento, generacion, unidades_vendidas, descripcion, imagen) VALUES
(1,'PlayStation 5','Sony',2020,'Novena',75.0,
 'Consola de sobremesa con SSD de alta velocidad, trazado de rayos por hardware y el mando DualSense con retroalimentación háptica.',
 '/img/plataformas/1.svg'),
(2,'Xbox Series X','Microsoft',2020,'Novena',30.0,
 'La consola más potente de Microsoft: 12 TFLOPS, Quick Resume y compatibilidad con cuatro generaciones de juegos Xbox.',
 '/img/plataformas/2.svg'),
(3,'Nintendo Switch','Nintendo',2017,'Octava',146.0,
 'Consola híbrida que alterna entre modo portátil y modo televisor. Es la consola de Nintendo más vendida de la historia.',
 '/img/plataformas/3.svg'),
(4,'PC','Multiplataforma',1985,'Continua',0.0,
 'Plataforma abierta y actualizable. Domina el mercado digital gracias a Steam, los mods y el hardware configurable.',
 '/img/plataformas/4.svg'),
(5,'PlayStation 2','Sony',2000,'Sexta',160.0,
 'La consola más vendida de todos los tiempos. Su lector de DVD la convirtió también en el reproductor doméstico de una generación.',
 '/img/plataformas/5.svg'),
(6,'Nintendo 64','Nintendo',1996,'Quinta',32.9,
 'Primera consola de Nintendo en 3D. Introdujo el stick analógico y el gatillo Z, sentando las bases del control moderno.',
 '/img/plataformas/6.svg');

-- ------------------------------- JUEGOS -------------------------------
INSERT INTO juegos (id, titulo, anio, genero, calificacion, precio, descripcion, imagen, estudio_id, plataforma_id) VALUES
(1,'The Legend of Zelda: Breath of the Wild',2017,'Aventura',97,59.99,
 'Hyrule reconstruido como un mundo abierto de exploración libre, física emergente y santuarios de ingenio.',
 '/img/juegos/1.svg',1,3),
(2,'Super Mario Odyssey',2017,'Plataformas',97,59.99,
 'Mario recorre reinos temáticos con Cappy, una gorra que le permite poseer enemigos y objetos para resolver el escenario.',
 '/img/juegos/2.svg',1,3),
(3,'Super Mario 64',1996,'Plataformas',94,29.99,
 'El salto de Mario a las tres dimensiones. Definió el control de cámara y el movimiento en los juegos 3D.',
 '/img/juegos/3.svg',1,6),
(4,'The Legend of Zelda: Ocarina of Time',1998,'Aventura',99,29.99,
 'Fijado de objetivo, viaje en el tiempo y mazmorras memorables. Sigue siendo el juego mejor valorado de la historia.',
 '/img/juegos/4.svg',1,6),
(5,'Red Dead Redemption 2',2018,'Acción-aventura',97,49.99,
 'Arthur Morgan y la banda de Van der Linde huyen del ocaso del salvaje oeste en un mundo de detalle obsesivo.',
 '/img/juegos/5.svg',2,1),
(6,'Grand Theft Auto V',2013,'Acción',96,29.99,
 'Tres protagonistas, una ciudad satírica y golpes que se planifican y ejecutan cambiando de personaje en tiempo real.',
 '/img/juegos/6.svg',2,4),
(7,'Grand Theft Auto: San Andreas',2004,'Acción',95,19.99,
 'CJ regresa a Los Santos en el mundo abierto más ambicioso de la sexta generación: tres ciudades y campo abierto.',
 '/img/juegos/7.svg',2,5),
(8,'Elden Ring',2022,'RPG de acción',96,59.99,
 'Las Tierras Intermedias, escritas junto a George R. R. Martin: un soulslike de mundo abierto con exploración a caballo.',
 '/img/juegos/8.svg',3,1),
(9,'Dark Souls III',2016,'RPG de acción',89,39.99,
 'Combate deliberado, hogueras y una ciudad en ruinas donde cada enemigo exige leer sus animaciones antes de atacar.',
 '/img/juegos/9.svg',3,2),
(10,'Bloodborne',2015,'RPG de acción',92,19.99,
 'Yharnam gótica y agresiva: sin escudo, el sistema de recuperación premia contraatacar en lugar de retroceder.',
 '/img/juegos/10.svg',3,1),
(11,'Half-Life 2',2004,'Disparos en primera persona',96,9.99,
 'Gordon Freeman y la pistola de gravedad en Ciudad 17. Convirtió la física en mecánica de juego y en lenguaje narrativo.',
 '/img/juegos/11.svg',4,4),
(12,'Portal 2',2011,'Puzles',95,9.99,
 'Portales, geles de propulsión y una escritura cómica excepcional en las ruinas del complejo Aperture Science.',
 '/img/juegos/12.svg',4,4),
(13,'Left 4 Dead 2',2009,'Disparos cooperativo',89,9.99,
 'Cuatro supervivientes, hordas infinitas y un director de IA que reparte enemigos y recursos según cómo juegues.',
 '/img/juegos/13.svg',4,2),
(14,'The Witcher 3: Wild Hunt',2015,'RPG',93,39.99,
 'Geralt de Rivia busca a Ciri en un mundo abierto donde hasta los contratos secundarios plantean dilemas morales.',
 '/img/juegos/14.svg',5,4),
(15,'Cyberpunk 2077',2020,'RPG',86,59.99,
 'Night City en primera persona: implantes, corporaciones y un fantasma digital alojado en la cabeza de V.',
 '/img/juegos/15.svg',5,2),
(16,'The Last of Us Part II',2020,'Acción-aventura',93,39.99,
 'Una historia de venganza contada desde dos perspectivas enfrentadas, con sigilo tenso y animación facial de referencia.',
 '/img/juegos/16.svg',6,1),
(17,'Uncharted 4: El desenlace del ladrón',2016,'Acción-aventura',93,19.99,
 'Nathan Drake sale del retiro para buscar el tesoro del pirata Henry Avery junto a su hermano perdido.',
 '/img/juegos/17.svg',6,1),
(18,'Jak and Daxter: El legado de los precursores',2001,'Plataformas',90,14.99,
 'Plataformas 3D sin pantallas de carga: un mundo continuo que se recorre de punta a punta sin cortes.',
 '/img/juegos/18.svg',6,5);
