# tools/urban-benchmark — benchmark morfológico offline

Herramienta de investigación **offline**. Convierte métricas agregadas de ciudades atlánticas
reales en envelopes que corrigen los parámetros del generador de `ciudad_del_umbral_v1`.

No forma parte del juego. Ningún archivo de este directorio es importado por `packages/shared`,
`packages/simulation` ni `apps/web`, y ninguna geometría de OpenStreetMap entra en el runtime.

## Por qué existe

`PLAN_improvements.md` §5 Fase 0 exige que el benchmark morfológico real forme parte del gate de V.d.
Sin él, "el centro es más denso que la periferia" es una intuición del que escribe el generador. Con
él, cada receta de `UrbanRole` tiene un rango medido que no debe violar.

La comparación es **agregada por diseño**: se comparan densidades, áreas de manzana y coberturas, no
trazados. Copiar layouts de ciudades reales sería un problema de propiedad intelectual
(AGENTS.md: "No reutilizar… mapas") e innecesario: lo que se quiere transferir es la estadística.

## Instalación

```bash
python3 -m venv /tmp/osm-venv
/tmp/osm-venv/bin/pip install -r requirements.lock.txt
```

Versiones fijadas en `requirements.lock.txt` (resueltas el 2026-10-28): osmnx 1.9.3, networkx 3.7,
geopandas 1.2.0, shapely 2.2.0, pyproj 3.8.0. Cambiar osmnx sin revisar su API de `bbox` y de
settings cambia resultados.

## Uso

```bash
./run.sh                       # barrida reanudable + envelopes + provenance
python3 -m urban_benchmark.cli extract --only bilbao__civic_centre --verbose
python3 -m urban_benchmark.cli envelopes
python3 -m urban_benchmark.cli provenance
```

`run.sh` repite la barrida hasta tener las 28 ventanas o agotar los intentos, porque los endpoints
públicos de Overpass están saturados buena parte del día. Las ventanas ya extraídas se cachean en
`.cache/metrics/` (ignorado por Git): re-ejecutar sólo rehace los huecos.

## Muestras

28 ventanas = 4 ciudades × 7 familias, cada una de **256 × 256 m**, que es la dimensión de un
distrito V.d a 4 m por celda (`windows.json`, `windowSideMeters`).

| Ciudad | Familias |
| --- | --- |
| Liverpool | Baltic Triangle, Frutonian, Ropewalks, Childwall, Brunswick Dock, Edge Hill, St George's Plateau |
| Manchester | Cathedral Gates, Victoria Park, Northern Quarter, Chorlton, Ancoats, Piccadilly, St Peter's Square |
| Bilbao | Casco Viejo, Ensanche, Indautxu, Artxanda, Zorrotza, Concordia, Plaza Moyúa |
| Philadelphia | Society Hill, Northern Liberties, University City, Roxborough, Port Richmond, 30th Street, City Hall |

Familias: `irregular_historic`, `ensanche`, `mixed_dense`, `low_density_residential`,
`industrial_edge`, `railway`, `civic_centre`. Son las siete formas que el generador tiene que saber
producir; no son distritos concretos de esas ciudades.

## Métricas extraídas

- **calle**: longitud total, densidad km/km², intersecciones y densidad, longitud media de tramo,
  entropía de orientación (8 bins ponderados por longitud, 0–3 bits; una retícula ortogonal da ~1 bit,
  un trazado irregular mucho más);
- **manzanas**: área por cara mediante `polygonize` de la red proyectada — recuento, media, mediana,
  p25, p75, máximo y mediana expresada en celdas de 4 m;
- **edificado**: huella total y porcentaje de cobertura sobre la ventana;
- **verde**: superficie disuelta de `landuse`/`leisure` y porcentaje;
- **equipamientos**: recuentos por familia (educación, salud, servicios públicos, culto,
  alimentación/retail, movilidad);
- **mezcla funcional**: clases distintas de `amenity`/`shop` y entropía sobre las familias.

Todo se calcula en la proyección UTM local de la ventana (`_utm_crs`), nunca en grados.

## Qué se versiona

- `windows.json` — manifest de muestras y anclas.
- `docs/urban-benchmark/metrics-v1.json` — métricas agregadas por ventana.
- `docs/urban-benchmark/envelopes-v1.json` — envelopes por familia.
- `docs/urban-benchmark/provenance-v1.json` — herramienta, versiones, fecha y atribución.

Qué **no** se versiona: las respuestas crudas de Overpass (`.cache/`) y cualquier geometría, propia o
de referencia. Un `.geojson` de manzanas reales tentaría a cualquiera a "ajustar el generador hasta
que calce", que es exactamente copiar.

## Atribución

Los datos derivados son © OpenStreetMap contributors, licencia **ODbL 1.0**
(<https://www.openstreetmap.org/copyright>, <https://opendatacommons.org/licenses/odbl/1-0/>).
`provenance-v1.json` la declara; cualquier publicación que difunda las métricas debe conservar el
crédito.

## Notas de implementación que no son obvias

- `ox.settings.overpass_rate_limit = False`: OSMnx 1.9.3 lanza `UnboundLocalError` dentro de
  `_get_overpass_pause` cuando la sonda `/api/status` falla, que es justo cuando el servidor está
  saturado. El backoff pasa a ser propio (`_fetch_with_retry`).
- `settings.overpass_url` es la **base** sin `/interpreter`; OSMnx añade el sufijo. Poner la URL
  completa produce `/api/interpreter/interpreter`.
- `overpass-api.de` es el único endpoint que responde con datos en las pruebas del 2026-10-28:
  `kumi.systems` devuelve vacío, `maps.mail.ru` exige allowlist y `openstreetmap.fr` responde 403.
  Mantener un endpoint muerto en la rotación es peor que tener menos: produce ventanas con métricas
  cero que parecen medidas reales.
- Los reintentos rotan endpoint también ante errores no transitorios (un 400 de un mirror no dice
  nada del query) y abandonan **la ventana**, no la barrida: el corpus es reanudable por diseño.
