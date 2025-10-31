import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

// ============================================
// SCHEMAS PARA ADMINS (login clásico)
// ============================================

const usernameSchema = z.string()
    .min(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
    .max(30, { message: 'El nombre de usuario no puede superar los 30 caracteres' })
    .regex(/^[a-z0-9._-]+$/i, { message: 'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo' })

// Schema para registro de admin
export const registerAdminSchema = z.object({
    name: z.string().min(2).max(100),
    username: usernameSchema,
    email: z.string().email({ message: 'El correo electrónico no es válido' }),
    password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
    confirmPassword: z.string().min(6).optional()
}).refine(data => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
})

// Schema para login de admin
export const loginAdminSchema = z.object({
    email: z.string().email().optional(),
    username: usernameSchema.optional(),
    password: z.string().min(1, { message: 'La contraseña es obligatoria' })
}).superRefine((val, ctx) => {
    if (!val.email && !val.username) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Debes proporcionar correo electrónico o nombre de usuario',
            path: ['email']
        })
    }
})

export const createAdminSchema = z.object({
    email: z.string().email({ message: 'El correo electrónico no es válido' }),
    username: usernameSchema,
    password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
    name: z.string().min(2).max(100),
    image: z.string().url().optional()
})

// Schema para actualizar admin
export const updateAdminSchema = z.object({
    email: z.string().email().optional(),
    username: usernameSchema.optional(),
    password: z.string().min(6).optional(),
    name: z.string().min(2).max(100).optional(),
    image: z.string().url().optional().nullable()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar'
})



// ============================================
// SCHEMAS PARA USERS (Firebase)
// ============================================

export const firebaseRegisterSchema = z.object({
    idToken: z.string().min(1, 'Token de Firebase requerido'),
    username: usernameSchema,
    name: z.string().min(2).max(100),
    userTypeName: z.string().optional(),
    image: z.string().url().optional()
})

export const firebaseLoginSchema = z.object({
    idToken: z.string().min(1, 'Token de Firebase requerido')
})

// ============================================
// SCHEMAS COMPARTIDOS
// ============================================

const userTypeSchema = z.object({
    name: z.string()
        .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
        .max(50, { message: 'El nombre no puede superar los 50 caracteres' })
        .regex(/^[a-z_]+$/, { message: 'El nombre solo puede contener letras minúsculas y guiones bajos' }),
    public_name: z.string()
        .min(2, { message: 'El nombre público debe tener al menos 2 caracteres' })
        .max(100, { message: 'El nombre público no puede superar los 100 caracteres' })
})

// ============================================
// MIDDLEWARES
// ============================================

export async function validateRegisterAdmin(req: FastifyRequest) {
    // @ts-ignore
    req.body = registerAdminSchema.parse(req.body)
}

export async function validateLoginAdmin(req: FastifyRequest) {
    // @ts-ignore
    req.body = loginAdminSchema.parse(req.body)
}

export async function validateFirebaseRegister(req: FastifyRequest) {
    // @ts-ignore
    req.body = firebaseRegisterSchema.parse(req.body)
}

export async function validateFirebaseLogin(req: FastifyRequest) {
    // @ts-ignore
    req.body = firebaseLoginSchema.parse(req.body)
}

export async function validateUserType(req: FastifyRequest) {
    // @ts-ignore
    req.body = userTypeSchema.parse(req.body)
}

export async function validateIdParam(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const numId = parseInt(id)

    if (isNaN(numId) || numId <= 0) {
        return reply.code(400).send({ message: 'ID inválido' })
    }
}

export async function validateCreateAdmin(req: FastifyRequest) {
    // @ts-ignore
    req.body = createAdminSchema.parse(req.body)
}

export async function validateUpdateAdmin(req: FastifyRequest) {
    // @ts-ignore
    req.body = updateAdminSchema.parse(req.body)
}