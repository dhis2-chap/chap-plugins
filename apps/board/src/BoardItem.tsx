import type { DashboardPluginProps } from '@chap-widgets/shared'
import { Button, ButtonStrip } from '@dhis2/ui'
import React, { Suspense, useCallback, useState } from 'react'
import { type SeedItem } from './boardApi'
import styles from './BoardItem.module.css'
import { pluginComponents } from './plugins'

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
                            setDashboardItemDetails={setDashboardItemDetails}
                        />
                    </Suspense>
                ) : (
                    <p className={styles.placeholder}>
                        No widget source for “{item.widget}” under widgets/.
                    </p>
                )}
            </div>
        </div>
    )
}
