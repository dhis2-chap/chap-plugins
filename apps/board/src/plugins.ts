import type { DashboardPluginProps } from '@chap-widgets/shared'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Every widget's Plugin, imported from source — this glob is what makes the
 * board render live widget code with no deploy step in the loop.
 *
 * The 6 `../` (not the 3 you'd expect from this file's own location under
 * apps/board/src/) are because d2-app-scripts mirrors this file into
 * apps/board/.d2/shell/src/D2App/ before Vite ever serves or transforms it —
 * that mirrored copy is where import.meta.glob's relative pattern is
 * actually resolved. Verified by inspecting the transformed module at
 * /src/D2App/plugins.ts in the dev server.
 */
const modules = import.meta.glob<{
    default: ComponentType<DashboardPluginProps>
}>(['../../../../../../widgets/*/src/Plugin.tsx', '!**/_template/**'])

const widgetFromPath = (modulePath: string) =>
    modulePath.match(/\/widgets\/([^/]+)\/src\/Plugin\.tsx$/)?.[1] ?? modulePath

export const pluginComponents: Record<
    string,
    LazyExoticComponent<ComponentType<DashboardPluginProps>>
> = Object.fromEntries(
    Object.entries(modules).map(([modulePath, loader]) => [
        widgetFromPath(modulePath),
        lazy(loader),
    ])
)
