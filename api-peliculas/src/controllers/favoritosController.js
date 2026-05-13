const prisma = require('../config/prisma')
const AppError = require('../utils/AppError')

// POST /api/favoritos/:peliculaId
const añadirFavorito = async (req, res, next) => {
  try {
    const peliculaId = Number(req.params.peliculaId)
    const usuarioId = req.usuario.id

    // Verificar que la película existe
    const pelicula = await prisma.pelicula.findUnique({ where: { id: peliculaId } })
    if (!pelicula) {
      throw new AppError('Película no encontrada', 404)
    }

    try {
      const favorito = await prisma.favorito.create({
        data: {
          usuarioId,
          peliculaId
        }
      })
      res.status(201).json({ ok: true, favorito })
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError('Esta película ya está en tus favoritos', 409)
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

// DELETE /api/favoritos/:peliculaId
const quitarFavorito = async (req, res, next) => {
  try {
    const peliculaId = Number(req.params.peliculaId)
    const usuarioId = req.usuario.id

    const favorito = await prisma.favorito.findFirst({
      where: { usuarioId, peliculaId }
    })

    if (!favorito) {
      throw new AppError('Favorito no encontrado', 404)
    }

    await prisma.favorito.delete({
      where: { id: favorito.id }
    })

    res.json({ ok: true, mensaje: 'Eliminado de favoritos' })
  } catch (err) {
    next(err)
  }
}

// GET /api/favoritos
const listarFavoritos = async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id

    const favoritos = await prisma.favorito.findMany({
      where: { usuarioId },
      include: {
        pelicula: {
          select: {
            id: true,
            titulo: true,
            anio: true,
            nota: true,
            director: { select: { nombre: true } },
            genero: { select: { nombre: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(favoritos)
  } catch (err) {
    next(err)
  }
}

module.exports = { añadirFavorito, quitarFavorito, listarFavoritos }