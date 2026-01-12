module.exports = {
    apps: [
        {
            name: 'tesina-backend',
            script: 'dist/index.js',
            env_file: '.env',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
}
