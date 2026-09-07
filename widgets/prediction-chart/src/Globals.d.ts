declare module '*.module.css'
declare module '*.css'
declare module '@dhis2/d2-i18n'
// maplibre-gl's worker is imported as a vite asset URL by @chap-widgets/shared
declare module '*?worker&url' {
    const url: string
    export default url
}
