import { Button, ButtonStrip } from '@dhis2/ui'
import React, { useState } from 'react'
import styles from './App.module.css'
import Plugin from './Plugin'

/**
 * Standalone dev harness for `pnpm start` — simulates the Dashboard app
 * hosting the plugin, with a toggle between edit (config form) and view.
 * Only the plugin entrypoint ships to dashboards; this app entrypoint exists
 * for local development.
 */
const App = () => {
    const [mode, setMode] = useState<'edit' | 'view'>('edit')

    return (
        <div className={styles.harness}>
            <ButtonStrip>
                <Button
                    small
                    toggled={mode === 'edit'}
                    onClick={() => setMode('edit')}
                >
                    Edit mode
                </Button>
                <Button
                    small
                    toggled={mode === 'view'}
                    onClick={() => setMode('view')}
                >
                    View mode
                </Button>
            </ButtonStrip>
            <div className={styles.pluginFrame}>
                <Plugin
                    dashboardItemId="local-preview"
                    dashboardMode={mode}
                    dashboardItemFilters={{}}
                />
            </div>
        </div>
    )
}

export default App
