/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'chap-widget-outbreak-map',
    title: 'CHAP · Outbreak Map',
    minDHIS2Version: '2.40',

    // Makes the plugin entrypoint available as a Dashboard item
    pluginType: 'DASHBOARD',

    entryPoints: {
        app: './src/App.tsx',
        plugin: './src/Plugin.tsx',
    },

    viteConfigExtensions: './vite.config.mts',
}

module.exports = config
