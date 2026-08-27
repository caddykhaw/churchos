import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deprovisionSubdomain,
  getSubdomainRecordName,
  provisionSubdomain
} from './cloudflare'

const runtimeConfig = {
  cloudflareApiToken: 'test-token',
  cloudflareZoneId: 'test-zone'
}

function cloudflareResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('Cloudflare DNS provisioning', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        CLOUDFLARE_EMAIL: 'test@example.com'
      }
    })
    vi.stubGlobal('createError', ({ message, statusCode }: { message: string, statusCode: number }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([
    ['', 'too short'],
    ['ab', 'too short'],
    ['Uppercase', 'uppercase'],
    ['-leading', 'leading hyphen'],
    ['trailing-', 'trailing hyphen'],
    ['has.dot', 'dot'],
    ['app', 'reserved subdomain'],
    ['www', 'reserved subdomain'],
    ['a'.repeat(31), 'too long']
  ])('rejects an invalid slug: %s (%s)', (slug) => {
    expect(() => getSubdomainRecordName(slug)).toThrow('Invalid organization subdomain slug')
  })

  it('returns the fully qualified record name for a valid slug', () => {
    expect(getSubdomainRecordName('grace-church')).toBe('grace-church.churchos.my')
  })

  it('creates the managed CNAME using the fully qualified record name', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      cloudflareResponse({ success: true, result: { id: 'record-id' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await provisionSubdomain('grace-church')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/test-zone/dns_records',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'X-Auth-Email': 'test@example.com',
          'X-Auth-Key': 'test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: 'grace-church.churchos.my',
          content: 'churchos.my',
          ttl: 3600,
          proxied: true
        })
      })
    )
  })

  it('does not call fetch when credentials are not configured', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ cloudflareApiToken: '', cloudflareZoneId: '' }))
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await provisionSubdomain('grace-church')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never calls fetch for an invalid slug', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(provisionSubdomain('bad.slug')).rejects.toThrow('Invalid organization subdomain slug')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deprovisions only an exact managed CNAME record', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(cloudflareResponse({
        success: true,
        result: [{
          id: 'record-id',
          type: 'CNAME',
          name: 'grace-church.churchos.my',
          content: 'churchos.my'
        }]
      }))
      .mockResolvedValueOnce(cloudflareResponse({ success: true, result: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await deprovisionSubdomain('grace-church')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.cloudflare.com/client/v4/zones/test-zone/dns_records?name=grace-church.churchos.my&type=CNAME'
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.cloudflare.com/client/v4/zones/test-zone/dns_records/record-id'
    )
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: 'DELETE' }))
  })

  it('does not delete a CNAME that is not managed by ChurchOS', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(cloudflareResponse({
      success: true,
      result: [{
        id: 'other-record',
        type: 'CNAME',
        name: 'grace-church.churchos.my',
        content: 'unrelated.example.com'
      }]
    }))
    vi.stubGlobal('fetch', fetchMock)

    await deprovisionSubdomain('grace-church')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
