import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

// username: 3–30 chars, a-z 0-9 . _ -
const usernameSchema = z.string()
  .min(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
  .max(30, { message: 'El nombre de usuario no puede superar los 30 caracteres' })
  .regex(/^[a-z0-9._-]+$/i, { message: 'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo' })

const registerSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
              .max(50, { message: 'El nombre no puede superar los 50 caracteres' }),
  username: usernameSchema,
  email: z.string().email({ message: 'El correo electrónico no es válido' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
  confirmPassword: z.string().min(6, { message: 'La confirmación de contraseña debe tener al menos 6 caracteres' }),
  // opcionales por si los enviás desde el front:
  roleId: z.number().int().positive().optional(),
  userTypeId: z.number().int().positive().optional()
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
})

// Login con email O username (al menos uno)
const loginSchema = z.object({
  email: z.string().email({ message: 'El correo electrónico no es válido' }).optional(),
  username: usernameSchema.optional(),
  password: z.string().min(1, { message: 'La contraseña es obligatoria' })
}).superRefine((val, ctx) => {
  if (!val.email && !val.username) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Debes proporcionar correo electrónico o nombre de usuario',
      path: ['email'] // o ['username'], solo para ubicar el error
    })
  }
})

// Schema para roles
const roleSchema = z.object({
  name: z.string()
    .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
    .max(50, { message: 'El nombre no puede superar los 50 caracteres' })
    .regex(/^[a-z_]+$/, { message: 'El nombre solo puede contener letras minúsculas y guiones bajos' }),
  public_name: z.string()
    .min(2, { message: 'El nombre público debe tener al menos 2 caracteres' })
    .max(100, { message: 'El nombre público no puede superar los 100 caracteres' })
})

// Schema para tipos de usuario
const userTypeSchema = z.object({
  name: z.string()
    .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
    .max(50, { message: 'El nombre no puede superar los 50 caracteres' })
    .regex(/^[a-z_]+$/, { message: 'El nombre solo puede contener letras minúsculas y guiones bajos' }),
  public_name: z.string()
    .min(2, { message: 'El nombre público debe tener al menos 2 caracteres' })
    .max(100, { message: 'El nombre público no puede superar los 100 caracteres' })
})

// Middlewares existentes
export async function validateRegister(req: FastifyRequest) {
  // @ts-ignore
  req.body = registerSchema.parse(req.body)
}

export async function validateLogin(req: FastifyRequest) {
  // @ts-ignore
  req.body = loginSchema.parse(req.body)
}

// Nuevos middlewares para roles
export async function validateRole(req: FastifyRequest) {
  // @ts-ignore
  req.body = roleSchema.parse(req.body)
}

// Nuevos middlewares para tipos de usuario
export async function validateUserType(req: FastifyRequest) {
  // @ts-ignore
  req.body = userTypeSchema.parse(req.body)
}

// Middleware para validar IDs en parámetros
export async function validateIdParam(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string }
  const numId = parseInt(id)
  
  if (isNaN(numId) || numId <= 0) {
    return reply.code(400).send({ message: 'ID inválido' })
  }
}