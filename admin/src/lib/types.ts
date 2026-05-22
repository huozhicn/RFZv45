export interface TenantConfig {
  tenantName: string
  tenantId: string | null
  logo: string
  primaryColor: string
  isPlatform: boolean
  sdbEndpoint: string
  sdbNamespace: string
  sdbDatabase: string
}
