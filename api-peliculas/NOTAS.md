# NOTAS — Lab Prisma ORM

## Pregunta 1: ¿Qué ventajas concretas ofrece Prisma frente a escribir SQL en crudo?

**Ventaja 1 — Tipado y autocompletado**

Con `pool.query()` en crudo, una query como esta no da ningún error hasta que
explota en runtime:

```js
// SQL crudo — el error solo aparece al ejecutar
await pool.query("SELECT * FROM pelicuals WHERE id = $1", [id]);
//                              ^^^^^^^ typo invisible
```

Con Prisma, el cliente está generado a partir del schema, así que el editor
autocompletea los nombres de modelos y campos, y cualquier campo inexistente da
error en tiempo de desarrollo antes de llegar a producción:

```js
// Prisma — error inmediato si 'pelicual' no existe en el schema
await prisma.pelicual.findUnique({ where: { id } }); // ❌ TypeScript/IDE lo detecta
await prisma.pelicula.findUnique({ where: { id } }); // ✅
```

**Ventaja 2 — Relaciones e includes sin JOINs manuales**

En SQL crudo, para obtener una película con su director, género y conteo de reseñas
necesitamos escribir y mantener un JOIN largo a mano:

```sql
SELECT p.*, d.nombre AS director, g.nombre AS genero, COUNT(r.id) AS num_resenas
FROM peliculas p
LEFT JOIN directores d ON d.id = p.director_id
LEFT JOIN generos g ON g.id = p.genero_id
LEFT JOIN resenas r ON r.pelicula_id = p.id
GROUP BY p.id, d.nombre, g.nombre
```

Con Prisma, el mismo resultado se expresa de forma declarativa y Prisma genera el
SQL óptimo por nosotros:

```js
await prisma.pelicula.findUnique({
  where: { id },
  include: {
    director: true,
    genero: true,
    _count: { select: { resenas: true } },
  },
});
```

Además, si el schema cambia (renombramos una columna, añadimos una relación), Prisma
Client se regenera con `prisma generate` y el compilador señala todos los sitios
del código que hay que actualizar, en lugar de descubrirlos uno a uno en producción.

---

## Pregunta 2: ¿Qué hace `prisma.$transaction` y en qué difieren sus dos formas?

Ambas formas garantizan **atomicidad**: si cualquier operación dentro falla, todas
se revierten como si no hubieran ocurrido. La diferencia está en el caso de uso:

### Forma 1 — Array de queries (transacción secuencial)

```js
const [peliculas, total] = await prisma.$transaction([
  prisma.pelicula.findMany({ where, skip, take }),
  prisma.pelicula.count({ where }),
]);
```

Prisma ejecuta todas las queries **en paralelo dentro de la misma transacción** y
devuelve un array con los resultados en el mismo orden. Es ideal cuando las queries
son **independientes entre sí** y solo necesitas que se ejecuten juntas por
consistencia (por ejemplo, que el `count` y el `findMany` reflejen el mismo estado
de la tabla, sin que otra escritura se cuele entre medias).

### Forma 2 — Callback interactivo

```js
const pelicula = await prisma.$transaction(async (tx) => {
  const director = await tx.director.upsert({ ... })
  const pelicula = await tx.pelicula.create({
    data: { ..., directorId: director.id }
  })
  return pelicula
})
```

Aquí el callback recibe `tx`, un cliente de Prisma aislado dentro de la
transacción. Las queries se ejecutan **secuencialmente** y cada una puede usar
el resultado de la anterior. Es imprescindible cuando hay **dependencia de datos**
entre operaciones: en este lab, necesitamos el `id` del director recién creado
antes de poder insertar la película que lo referencia.

**Resumen:**

|                           | Array `[q1, q2]` | Callback `async (tx)`       |
| ------------------------- | ---------------- | --------------------------- |
| Ejecución                 | Paralela         | Secuencial                  |
| Dependencia entre queries | No               | Sí                          |
| Caso de uso típico        | Count + findMany | Upsert → create relacionado |

---

## Pregunta 3: ¿Qué archivo NO deberías commitear y cuáles sí deben estar en el repo?

### ❌ NO commitear: `.env`

El archivo `.env` contiene la `DATABASE_URL` con usuario y contraseña de la base
de datos en texto plano. Commitearlo expone las credenciales de producción a
cualquiera que tenga acceso al repositorio. Debe estar en `.gitignore` siempre.

Como buena práctica se incluye un `.env.example` con las claves pero sin valores
reales, para que otros desarrolladores sepan qué variables necesitan configurar:
DATABASE_URL="postgresql://USUARIO:PASSWORD@localhost:5432/peliculas_db?schema=public"
JWT_SECRET=
JWT_EXPIRES_IN=24h

### ✅ SÍ deben estar en el repositorio:

- **`prisma/schema.prisma`** — es la fuente de verdad del modelo de datos. Sin él,
  nadie puede regenerar el cliente ni entender la estructura de la base de datos.

- **`prisma/migrations/`** — la carpeta completa de migraciones. Cada archivo
  `migration.sql` es el historial exacto de cómo ha evolucionado el schema. Sin
  ellas, otro desarrollador (o el servidor de producción) no puede reproducir el
  estado actual de la base de datos ejecutando `prisma migrate deploy`.

Commitear el schema y las migraciones pero no el `.env` es el patrón correcto:
cualquier desarrollador puede clonar el repo, crear su propio `.env` con sus
credenciales locales, ejecutar `npx prisma migrate dev` y tener la base de datos
en el estado exacto del proyecto.
