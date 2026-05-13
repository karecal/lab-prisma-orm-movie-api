const AppError = require('../utils/AppError')

const errorHandler = (err, req, res, next) => {
  // Handle AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message
    })
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'JSON inválido'
    })
  }

  // Handle unexpected errors
  console.error('Unexpected error:', err)
  res.status(500).json({
    error: 'Error interno del servidor'
  })
}

module.exports = errorHandler
