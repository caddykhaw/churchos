const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4'
const CHURCHOS_DOMAIN = 'churchos.my'
const CNAME_TARGET = 'churchos.my'
const SUBDOMAIN_SLUG_PATTERN = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/
const RESERVED_SUBDOMAINS = new Set(['app', 'www', 'localhost'])

interface CloudflareApiResponse<T> {
  success: boolean
  result: T
  errors?: Array<{
    code: number
    message: string
  }>
}

interface CloudflareDnsRecord {
  id: string
  type: string
  name: string
  content: string
}

interface CloudflareCredentials {
  apiToken: string
  zoneId: string
}

/**
 * Returns the complete DNS record name for an organization slug.
 *
 * Organization slugs are DNS labels: 3-30 lowercase alphanumeric characters
 * with optional, non-leading/non-trailing hyphens.
 */
export function getSubdomainRecordName(slug: string): string {
  if (!SUBDOMAIN_SLUG_PATTERN.test(slug) || RESERVED_SUBDOMAINS.has(slug)) {
    throw new Error('Invalid organization subdomain slug')
  }

  return `${slug}.${CHURCHOS_DOMAIN}`
}

function getCloudflareCredentials(): CloudflareCredentials | null {
  const config = useRuntimeConfig()

  if (!config.cloudflareApiToken || !config.cloudflareZoneId) {
    return null
  }

  return {
    apiToken: config.cloudflareApiToken,
    zoneId: config.cloudflareZoneId
  }
}

function getDnsRecordsUrl(zoneId: string): string {
  return `${CLOUDFLARE_API_BASE_URL}/zones/${encodeURIComponent(zoneId)}/dns_records`
}

function cloudflareHeaders(apiToken: string): HeadersInit {
  return {
    'X-Auth-Email': process.env.CLOUDFLARE_EMAIL || '',
    'X-Auth-Key': apiToken,
    'Content-Type': 'application/json'
  }
}

async function parseCloudflareResponse<T>(response: Response): Promise<CloudflareApiResponse<T>> {
  if (!response.ok) {
    throw new Error(`Cloudflare API request failed with status ${response.status}`)
  }

  const body = await response.json() as CloudflareApiResponse<T>

  if (!body.success) {
    throw new Error('Cloudflare API returned an unsuccessful response')
  }

  return body
}

/** Creates the proxied CNAME `{slug}.churchos.my` -> `churchos.my` (-> Pages). */
export async function provisionSubdomain(slug: string): Promise<void> {
  const recordName = getSubdomainRecordName(slug)
  const credentials = getCloudflareCredentials()

  if (!credentials) {
    console.warn('Cloudflare credentials not configured, skipping subdomain provisioning')
    return
  }

  try {
    const response = await fetch(getDnsRecordsUrl(credentials.zoneId), {
      method: 'POST',
      headers: cloudflareHeaders(credentials.apiToken),
      body: JSON.stringify({
        type: 'CNAME',
        name: recordName,
        content: CNAME_TARGET,
        ttl: 3600,
        proxied: true
      })
    })

    await parseCloudflareResponse<CloudflareDnsRecord>(response)
  } catch (error) {
    console.error('Cloudflare provisioning failed:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to provision subdomain'
    })
  }
}

/** Removes only the managed CNAME for `{slug}.churchos.my`, if it exists. */
export async function deprovisionSubdomain(slug: string): Promise<void> {
  const recordName = getSubdomainRecordName(slug)
  const credentials = getCloudflareCredentials()

  if (!credentials) {
    return
  }

  try {
    const recordsUrl = new URL(getDnsRecordsUrl(credentials.zoneId))
    recordsUrl.searchParams.set('name', recordName)
    recordsUrl.searchParams.set('type', 'CNAME')

    const recordsResponse = await fetch(recordsUrl, {
      headers: cloudflareHeaders(credentials.apiToken)
    })
    const records = await parseCloudflareResponse<CloudflareDnsRecord[]>(recordsResponse)
    const record = records.result.find(candidate =>
      candidate.name === recordName
      && candidate.type === 'CNAME'
      && candidate.content === CNAME_TARGET
    )

    if (!record) {
      return
    }

    const response = await fetch(`${getDnsRecordsUrl(credentials.zoneId)}/${encodeURIComponent(record.id)}`, {
      method: 'DELETE',
      headers: cloudflareHeaders(credentials.apiToken)
    })
    await parseCloudflareResponse<CloudflareDnsRecord>(response)
  } catch (error) {
    console.error('Cloudflare deprovisioning failed:', error)
  }
}
