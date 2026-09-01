import type { DashboardPluginProps } from '@chap-widgets/shared'
import { Button, ButtonStrip } from '@dhis2/ui'
import React, { Suspense, useCallback, useState } from 'react'
import { type SeedItem } from './boardApi'
import styles from './BoardItem.module.css'
import { pluginComponents } from './plugins'

/**
 * Contains a crash in one widget's Plugin (a failed dynamic import, or a
 * render-time exception) to this one board item, instead of letting it
 * propagate to the app-adapter's top-level ErrorBoundary and take down all
 * four items. Keyed by `mode` from the parent so toggling View/Edit remounts
 * this boundary and gives the plugin a fresh chance.
 */
class PluginErrorBoundary extends React.Component<
    { widgetName: string; children: React.ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error: unknown) {
        console.error(`board: "${this.props.widgetName}" Plugin crashed`, error)
    }

    render() {
        if (this.state.hasError) {
            return (
                <p className={styles.placeholder}>
                    “{this.props.widgetName}” crashed — see the browser console.
                </p>
            )
        }
        return this.props.children
    }
}

export const BoardItem = ({ item }: { item: SeedItem }) => {
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [title, setTitle] = useState<string | null>(null)
    const Plugin = pluginComponents[item.widget]

    const setDashboardItemDetails = useCallback<
        NonNullable<DashboardPluginProps['setDashboardItemDetails']>
    >((details) => setTitle(details.itemTitle ?? null), [])

    return (
        <div className={styles.item}>
            <div className={`${styles.header} board-drag-handle`}>
                <span className={styles.title}>{title ?? item.widget}</span>
                <span className="board-no-drag">
                    <ButtonStrip>
                        <Button
                            small
                            toggled={mode === 'view'}
                            onClick={() => setMode('view')}
                        >
                            View
                        </Button>
                        <Button
                            small
                            toggled={mode === 'edit'}
                            onClick={() => setMode('edit')}
                        >
                            Edit
                        </Button>
                    </ButtonStrip>
                </span>
            </div>
            <div className={styles.body}>
                {Plugin ? (
                    <PluginErrorBoundary key={mode} widgetName={item.widget}>
                        <Suspense
                            fallback={
                                <p className={styles.placeholder}>
                                    Loading {item.widget}…
                                </p>
                            }
                        >
                            <Plugin
                                dashboardItemId={item.id}
                                dashboardMode={mode}
                                dashboardItemFilters={{}}
                                setDashboardItemDetails={
                                    setDashboardItemDetails
                                }
                            />
                        </Suspense>
                    </PluginErrorBoundary>
                ) : (
                    <p className={styles.placeholder}>
                        No widget source for “{item.widget}” under widgets/.
                    </p>
                )}
            </div>
        </div>
    )
}
