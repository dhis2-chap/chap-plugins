import { CssReset, CssVariables } from '@dhis2/ui'
import React, { useEffect, useState } from 'react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import styles from './App.module.css'
import { Board } from './Board'
import { fetchSeed, type Seed } from './boardApi'
import { BoardItem } from './BoardItem'

const App = () => {
    const [seed, setSeed] = useState<Seed | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchSeed().then(setSeed, (loadError: Error) =>
            setError(loadError.message)
        )
    }, [])

    return (
        <div className={styles.app}>
            <CssReset />
            <CssVariables theme spacers colors elevations />
            {error ? (
                <p className={styles.error}>{error}</p>
            ) : seed ? (
                <Board
                    initialSeed={seed}
                    renderItem={(item) => <BoardItem item={item} />}
                />
            ) : (
                <p>Loading dashboard.seed.json…</p>
            )}
        </div>
    )
}

export default App
