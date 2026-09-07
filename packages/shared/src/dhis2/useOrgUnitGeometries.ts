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

export type OrgUnitGeometryContext = {
    features: OrgUnitFeature[]
    /** Deepest geometry-bearing ancestor shared by every returned org unit */
    contextFeature?: OrgUnitFeature
}

type OrgUnitAncestor = {
    id: string
    displayName: string
    level: number
    geometry?: OrgUnitGeometry
}

type OrgUnitWithGeometry = {
    id: string
    displayName: string
    geometry?: OrgUnitGeometry
    ancestors?: OrgUnitAncestor[]
}

type OrgUnitResponse = {
    orgUnits: {
        organisationUnits: OrgUnitWithGeometry[]
    }
}

const CHUNK_SIZE = 100

const toFeature = ({
    id,
    displayName,
    geometry,
}: OrgUnitAncestor | OrgUnitWithGeometry): OrgUnitFeature | undefined =>
    geometry
        ? {
              type: 'Feature',
              id,
              geometry,
              properties: { id, name: displayName },
          }
        : undefined

const findCommonContext = (
    orgUnits: OrgUnitWithGeometry[]
): OrgUnitFeature | undefined => {
    const [first, ...rest] = orgUnits
    if (!first) {
        return undefined
    }
    const commonAncestor = (first.ancestors ?? [])
        .filter(
            (candidate) =>
                candidate.geometry &&
                rest.every((orgUnit) =>
                    orgUnit.ancestors?.some(
                        (ancestor) => ancestor.id === candidate.id
                    )
                )
        )
        .sort((a, b) => b.level - a.level)[0]

    return commonAncestor ? toFeature(commonAncestor) : undefined
}

const useOrgUnitGeometryQuery = (orgUnitIds: string[]) => {
    const engine = useDataEngine()
    const ids = Array.from(new Set(orgUnitIds)).sort()

    return useQuery<OrgUnitGeometryContext>({
        queryKey: ['dhis2', 'orgUnitGeometries', ids],
        enabled: ids.length > 0,
        staleTime: Infinity,
        queryFn: async () => {
            const orgUnits: OrgUnitWithGeometry[] = []
            for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
                const chunk = ids.slice(start, start + CHUNK_SIZE)
                const response = (await engine.query({
                    orgUnits: {
                        resource: 'organisationUnits',
                        params: {
                            filter: `id:in:[${chunk.join(',')}]`,
                            fields: 'id,displayName,geometry,ancestors[id,displayName,level,geometry]',
                            pageSize: CHUNK_SIZE,
                        },
                    },
                })) as OrgUnitResponse
                orgUnits.push(...response.orgUnits.organisationUnits)
            }
            return {
                features: orgUnits
                    .map(toFeature)
                    .filter((feature): feature is OrgUnitFeature => !!feature),
                contextFeature: findCommonContext(orgUnits),
            }
        },
    })
}

/**
 * Fetches GeoJSON features for org unit ids plus the deepest ancestor shared
 * by all of them. The ancestor gives maps geographic context when a
 * prediction covers only part of a country or region.
 */
export const useOrgUnitGeometryContext = (orgUnitIds: string[]) =>
    useOrgUnitGeometryQuery(orgUnitIds)

/**
 * Fetches GeoJSON features (id, name, geometry) for org unit ids (as used in
 * CHAP entries) via the DHIS2 metadata API. Org units without geometry are
 * omitted from the result — callers decide how to surface the gap.
 */
export const useOrgUnitGeometries = (orgUnitIds: string[]) => {
    const { data, ...query } = useOrgUnitGeometryQuery(orgUnitIds)
    return { ...query, data: data?.features }
}
