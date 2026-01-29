import { SupabaseServerClient } from '@/lib/supabaseServer'
import { Supplier } from '@/types/database'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

type SupplierQuery = {
  label?: string
  search?: string
}

type SupplierInsert = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>
type SupplierUpdate = Partial<Omit<Supplier, 'id' | 'company_id' | 'created_at' | 'updated_at'>>

async function assertOwnerAccess(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string
) {
  const { data, error } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', profileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to verify owner access: ${error.message}`, 500)
  }

  if (!data) {
    throw new ServiceError('Unauthorized: not an owner for this company', 403)
  }
}

export async function listSuppliersForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  query: SupplierQuery = {}
): Promise<Supplier[]> {
  const { data: companyRows, error: companyError } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', profileId)

  if (companyError) {
    throw new ServiceError(`Failed to load companies: ${companyError.message}`, 500)
  }

  const companyIds = companyRows?.map((row) => row.company_id) || []
  if (companyIds.length === 0) {
    return []
  }

  let supplierQuery = supabase
    .from('suppliers')
    .select('*')
    .in('company_id', companyIds)
    .order('name', { ascending: true })

  if (query.label) {
    supplierQuery = supplierQuery.eq('label', query.label)
  }

  if (query.search) {
    const searchValue = `%${query.search}%`
    supplierQuery = supplierQuery.or(
      [
        `name.ilike.${searchValue}`,
        `label.ilike.${searchValue}`,
        `phone.ilike.${searchValue}`,
        `address.ilike.${searchValue}`,
        `address_line_2.ilike.${searchValue}`,
        `city.ilike.${searchValue}`,
        `state.ilike.${searchValue}`,
        `zipcode.ilike.${searchValue}`,
        `account_number.ilike.${searchValue}`,
      ].join(',')
    )
  }

  const { data, error } = await supplierQuery

  if (error) {
    throw new ServiceError(`Failed to load suppliers: ${error.message}`, 500)
  }

  return (data as Supplier[]) || []
}

export async function createSupplierForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  payload: SupplierInsert
): Promise<Supplier> {
  await assertOwnerAccess(supabase, profileId, payload.company_id)

  const { data, error } = await supabase
    .from('suppliers')
    .insert([payload])
    .select()
    .single()

  if (error) {
    throw new ServiceError(`Failed to create supplier: ${error.message}`, 500)
  }

  return data as Supplier
}

export async function updateSupplierForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  supplierId: string,
  payload: SupplierUpdate
): Promise<Supplier> {
  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .select('id, company_id')
    .eq('id', supplierId)
    .maybeSingle()

  if (supplierError) {
    throw new ServiceError(`Failed to load supplier: ${supplierError.message}`, 500)
  }

  if (!supplier) {
    throw new ServiceError('Supplier not found', 404)
  }

  const typedSupplier = supplier as Pick<Supplier, 'company_id'> | null
  if (!typedSupplier) {
    throw new ServiceError('Supplier not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, typedSupplier.company_id)

  const { data, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', supplierId)
    .select()
    .single()

  if (error) {
    throw new ServiceError(`Failed to update supplier: ${error.message}`, 500)
  }

  return data as Supplier
}
