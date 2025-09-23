import { pool } from '../db/db.js'
import { createRole, roleNameExists } from '../models/userRole.js'
import { createUserType, userTypeNameExists } from '../models/userType.js'

// Datos por defecto para roles
const defaultRoles = [
    { name: 'user', public_name: 'Usuario' },
    { name: 'admin', public_name: 'Administrador' },
    { name: 'super_admin', public_name: 'Super Administrador' }
]

// Datos por defecto para tipos de usuario
const defaultUserTypes = [
    { name: 'otro', public_name: 'Otro' },
    { name: 'estudiante', public_name: 'Estudiante' },
    { name: 'docente', public_name: 'Docente' },
    { name: 'investigador', public_name: 'Investigador' },
    { name: 'navegante', public_name: 'Navegante' },
    { name: 'timonel', public_name: 'Timonel' },
    { name: 'turista', public_name: 'Turista' },
    { name: 'profesional', public_name: 'Profesional' }
]

// Seeder para roles
export async function seedRoles() {
    console.log('🌱 Sembrando roles...')
    
    try {
        for (const role of defaultRoles) {
            const exists = await roleNameExists(role.name)
            if (!exists) {
                const roleId = await createRole(role.name, role.public_name)
                console.log(`✅ Rol creado: ${role.public_name} (ID: ${roleId})`)
            } else {
                console.log(`⏭️  Rol ya existe: ${role.public_name}`)
            }
        }
        console.log('✨ Roles sembrados exitosamente\n')
    } catch (error) {
        console.error('❌ Error sembrando roles:', error)
        throw error
    }
}

// Seeder para tipos de usuario
export async function seedUserTypes() {
    console.log('🌱 Sembrando tipos de usuario...')
    
    try {
        for (const userType of defaultUserTypes) {
            const exists = await userTypeNameExists(userType.name)
            if (!exists) {
                const userTypeId = await createUserType(userType.name, userType.public_name)
                console.log(`✅ Tipo creado: ${userType.public_name} (ID: ${userTypeId})`)
            } else {
                console.log(`⏭️  Tipo ya existe: ${userType.public_name}`)
            }
        }
        console.log('✨ Tipos de usuario sembrados exitosamente\n')
    } catch (error) {
        console.error('❌ Error sembrando tipos de usuario:', error)
        throw error
    }
}

// Seeder principal
export async function runSeeders() {
    console.log('🚀 Iniciando seeders...\n')
    
    try {
        await seedRoles()
        await seedUserTypes()
        console.log('🎉 Todos los seeders completados exitosamente!')
    } catch (error) {
        console.error('💥 Error ejecutando seeders:', error)
        throw error
    } finally {
        // Cerrar la conexión de la pool
        await pool.end()
    }
}

// Ejecutar automáticamente
console.log('Iniciando ejecución del seeder...')
runSeeders()
    .then(() => {
        console.log('🔄 Seeder finalizado')
        process.exit(0)
    })
    .catch((error) => {
        console.error('💥 Error fatal:', error)
        process.exit(1)
    })