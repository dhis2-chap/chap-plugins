import React, { useRef, useState } from 'react'
import RGL, { WidthProvider, type Layout } from 'react-grid-layout'
import {
    saveLayouts,
    type ItemLayout,
    type Seed,
    type SeedItem,
} from './boardApi'
import {
    GRID_COLUMNS,
    GRID_COMPACT_TYPE,
    GRID_PADDING_PX,
    GRID_ROW_HEIGHT_PX,
    MARGIN_PX,
    MAX_ITEM_GRID_HEIGHT,
    MAX_ITEM_GRID_WIDTH,
    MIN_ITEM_GRID_HEIGHT,
} from './gridConstants'
import { TopBar, type SaveStatus } from './TopBar'

const GridLayout = WidthProvider(RGL)

const AUTOSAVE_DELAY_MS = 800

const toItemLayouts = (layout: Layout[]): ItemLayout[] =>
    [...layout]
        .sort((a, b) => a.i.localeCompare(b.i))
        .map(({ i, x, y, w, h }) => ({ id: i, x, y, w, h }))

export const Board = ({
    initialSeed,
    renderItem,
}: {
    initialSeed: Seed
    renderItem: (item: SeedItem) => React.ReactNode
}) => {
    const [status, setStatus] = useState<SaveStatus>('saved')
    const [warnings, setWarnings] = useState<string[]>([])

    const gridLayout: Layout[] = initialSeed.items.map((item) => ({
        i: item.id,
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
        minH: MIN_ITEM_GRID_HEIGHT,
        maxH: MAX_ITEM_GRID_HEIGHT,
        maxW: MAX_ITEM_GRID_WIDTH,
    }))

    const currentRef = useRef<ItemLayout[]>(toItemLayouts(gridLayout))
    const lastSavedRef = useRef(JSON.stringify(currentRef.current))
    const timerRef = useRef<number | undefined>(undefined)

    const save = async (layouts: ItemLayout[]) => {
        window.clearTimeout(timerRef.current)
        setStatus('saving')
        try {
            const result = await saveLayouts(layouts)
            lastSavedRef.current = JSON.stringify(layouts)
            setWarnings(result.warnings)
            setStatus('saved')
        } catch (error) {
            console.error('board: saving the seed failed', error)
            setStatus('failed')
        }
    }

    const handleLayoutChange = (layout: Layout[]) => {
        const layouts = toItemLayouts(layout)
        currentRef.current = layouts
        if (JSON.stringify(layouts) === lastSavedRef.current) {
            return
        }
        setStatus('dirty')
        window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(
            () => void save(layouts),
            AUTOSAVE_DELAY_MS
        )
    }

    return (
        <>
            <TopBar
                name={initialSeed.dashboard.name}
                status={status}
                warnings={warnings}
                onSync={() => void save(currentRef.current)}
            />
            <GridLayout
                cols={GRID_COLUMNS}
                rowHeight={GRID_ROW_HEIGHT_PX}
                margin={MARGIN_PX}
                containerPadding={GRID_PADDING_PX}
                compactType={GRID_COMPACT_TYPE}
                layout={gridLayout}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".board-drag-handle"
                draggableCancel=".board-no-drag"
            >
                {initialSeed.items.map((item) => (
                    <div key={item.id}>{renderItem(item)}</div>
                ))}
            </GridLayout>
        </>
    )
}
