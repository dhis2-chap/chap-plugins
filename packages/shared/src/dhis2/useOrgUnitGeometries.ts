import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'

/** GeoJSON geometry as stored on DHIS2 org units (kept loose on purpose) */
export type OrgUnitGeometry = {
    type:
        | 'Point'
        | 'Polygon'
        | 'MultiPolygon'
        | 'LineString'
        | 'MultiLineString'
        | 'MultiPoint'
    coordinates: unknown
}

export type OrgUnitFeature = {
    type: 'Feature'
    id: string
    geometry: OrgUnitGeometry
    properties: { id: string; name: string }
}

type OrgUnitResponse = {
    orgUnits: {
        organisationUnits: Array<{
            id: string
            displayName: string
            geometry?: OrgUnitGeometry
        }>
    }
}

const CHUNK_SIZE = 100

/**
 * Fetches GeoJSON features (id, name, geometry) for org unit ids (as used in
 * CHAP entries) via the DHIS2 metadata API. Org units without geometry are
 * omitted from the result — callers decide how to surface the gap.
 */
export const useOrgUnitGeometries = (orgUnitIds: string[]) => {
    const engine = useDataEngine()
    const ids = Array.from(new Set(orgUnitIds)).sort()

    return useQuery<OrgUnitFeature[]>({
        queryKey: ['dhis2', 'orgUnitGeometries', ids],
        enabled: ids.length > 0,
        staleTime: Infinity,
        queryFn: async () => {
            const features: OrgUnitFeature[] = []
            for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
                const chunk = ids.slice(start, start + CHUNK_SIZE)
                const response = (await engine.query({
                    orgUnits: {
                        resource: 'organisationUnits',
                        params: {
                            filter: `id:in:[${chunk.join(',')}]`,
                            fields: 'id,displayName,geometry',
                            paging: 'false',
                        },
                    },
                })) as OrgUnitResponse
                for (const orgUnit of response.orgUnits.organisationUnits) {
                    if (!orgUnit.geometry) {
                        continue
                    }
                    features.push({
                        type: 'Feature',
                        id: orgUnit.id,
                        geometry: orgUnit.geometry,
                        properties: {
                            id: orgUnit.id,
                            name: orgUnit.displayName,
                        },
                    })
                }
            }
            return features
        },
    })
}
