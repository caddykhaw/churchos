import type { H3Event } from 'h3'
import type { Role } from '@churchos/database'

export function requireAuth(event: H3Event) {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }
  return event.context.user
}

export function requireOrg(event: H3Event) {
  requireAuth(event)

  if (!event.context.org) {
    throw createError({
      statusCode: 400,
      message: 'Organization context required'
    })
  }

  return event.context.org
}

export function requireRole(event: H3Event, role: Role) {
  const org = requireOrg(event)

  if (!org.userRoles.includes(role)) {
    throw createError({
      statusCode: 403,
      message: `Role '${role}' required`
    })
  }
}

/**
 * Gates access to a module for the current org context.
 * - Demo sandboxes always have every module (they're seeded with all three).
 * - Suspended orgs are blocked.
 * - Inactive orgs (registered but not yet activated) are blocked.
 * - Active orgs must subscribe to the module they're asking for.
 */
export function requireModule(event: H3Event, module: 'people' | 'journey' | 'pages') {
  const org = requireOrg(event)

  if (org.is_demo) {
    return org
  }

  if (org.subscription_status === 'suspended') {
    throw createError({
      statusCode: 402,
      message: 'Subscription suspended. Please contact support.'
    })
  }

  if (org.subscription_status !== 'active') {
    throw createError({
      statusCode: 403,
      message: 'This workspace is inactive. Activate your plan to use this module.'
    })
  }

  if (!org.subscribedModules.includes(module)) {
    throw createError({
      statusCode: 403,
      message: `Module '${module}' not included in your subscription`
    })
  }

  return org
}