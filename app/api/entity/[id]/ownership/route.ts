// app/api/entity/[id]/ownership/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, error, handleApiError } from '@/lib/api/responses'

interface RouteParams {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return error('Invalid entity ID format')
    const supabase = await createClient()

    // Verify entity exists
    const { data: entity } = await supabase
      .from('entities')
      .select('id, name, entity_type')
      .eq('id', id)
      .single()

    if (!entity) return notFound('Entity not found')

    // Get ownership records where this entity is the property or the owner
    const { data: asProperty } = await supabase
      .from('property_ownership')
      .select(`
        id, from_date, to_date, acquisition_type, acquisition_amount,
        shell_company, shell_company_name, notes, created_at,
        owner:entities!owner_entity_id(id, name)
      `)
      .eq('property_entity_id', id)
      .order('from_date', { ascending: true })

    const { data: asOwner } = await supabase
      .from('property_ownership')
      .select(`
        id, from_date, to_date, acquisition_type, acquisition_amount,
        shell_company, shell_company_name, notes, created_at,
        property:entities!property_entity_id(id, name)
      `)
      .eq('owner_entity_id', id)
      .order('from_date', { ascending: true })

    return success({
      entity: { id: (entity as any).id, name: (entity as any).name, type: (entity as any).entity_type },
      as_property: (asProperty || []).map((o: any) => ({
        id: o.id,
        owner_id: o.owner?.id,
        owner_name: o.owner?.name,
        from_date: o.from_date,
        to_date: o.to_date,
        acquisition_type: o.acquisition_type,
        acquisition_amount: o.acquisition_amount ? Number(o.acquisition_amount) : null,
        shell_company: o.shell_company,
        shell_company_name: o.shell_company_name,
        notes: o.notes,
      })),
      as_owner: (asOwner || []).map((o: any) => ({
        id: o.id,
        property_id: o.property?.id,
        property_name: o.property?.name,
        from_date: o.from_date,
        to_date: o.to_date,
        acquisition_type: o.acquisition_type,
        acquisition_amount: o.acquisition_amount ? Number(o.acquisition_amount) : null,
        shell_company: o.shell_company,
        shell_company_name: o.shell_company_name,
        notes: o.notes,
      })),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
