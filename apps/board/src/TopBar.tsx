import { Button } from '@dhis2/ui'
import React from 'react'
import styles from './TopBar.module.css'

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'failed'

const STATUS_LABEL: Record<SaveStatus, string> = {
    saved: 'Seed saved ✓',
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    failed: 'Save failed — see the browser console',
}

export const TopBar = ({
    name,
    status,
    warnings,
    onSync,
}: {
    name: string
    status: SaveStatus
    warnings: string[]
    onSync: () => void
}) => (
    <div className={styles.bar}>
        <h1 className={styles.name}>{name} — board</h1>
        <span className={status === 'failed' ? styles.failed : styles.status}>
            {STATUS_LABEL[status]}
        </span>
        {warnings.map((warning) => (
            <span key={warning} className={styles.warning}>
                ⚠ {warning}
            </span>
        ))}
        <Button small onClick={onSync} disabled={status === 'saving'}>
            Sync seed
        </Button>
    </div>
)
