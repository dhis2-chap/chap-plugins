/** Client for the board's Vite dev-middleware seed endpoints. */

export type ItemLayout = {
    id: string
    x: number
    y: number
    w: number
    h: number
}

export type SeedItem = {
    id: string
    widget: string
    layout: { x: number; y: number; w: number; h: number }
    config: Record<string, unknown> | null
}

export type Seed = {
    dashboard: { name: string; code: string }
    items: SeedItem[]
}

const request = async (init?: RequestInit) => {
    const response = await fetch('/__board/seed', init)
    const body = await response.json()
    if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`)
    }
    return body
}

export const fetchSeed = async (): Promise<Seed> => (await request()).seed

export const saveLayouts = (
    layouts: ItemLayout[]
): Promise<{ seed: Seed; warnings: string[] }> =>
    request({
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ layouts }),
    })
