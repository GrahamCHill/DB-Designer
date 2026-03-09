import { computed } from 'vue'
import { useApiStore } from '../stores/api'
import type { ApiExportTarget, RestEndpointNode, RestTypeNode } from '../types/api'

const EXPORT_TARGETS: Record<ApiExportTarget, { label: string; ext: string }> = {
  openapi: { label: 'OpenAPI 3.0', ext: 'openapi.json' },
  'rest-ts-fetch': { label: 'TypeScript Fetch Client', ext: 'client.ts' },
  'rest-js-fetch': { label: 'JavaScript Fetch Client', ext: 'client.js' },
  'rest-python-fastapi': { label: 'Python FastAPI Stubs', ext: 'fastapi.py' },
  'graphql-sdl': { label: 'GraphQL SDL', ext: 'graphql' },
  'graphql-resolvers-ts': { label: 'TypeScript Resolver Stubs', ext: 'resolvers.ts' },
  'graphql-resolvers-js': { label: 'JavaScript Resolver Stubs', ext: 'resolvers.js' },
  'federation-sdl': { label: 'Federation SDL', ext: 'federation.graphql' },
  'federation-subgraph-ts': { label: 'Apollo Subgraph Server (TypeScript)', ext: 'subgraph.ts' },
  'federation-subgraph-js': { label: 'Apollo Subgraph Server (JavaScript)', ext: 'subgraph.js' },
}

function toPascalCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'GeneratedType'
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value)
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : 'generatedItem'
}

function safeIdentifier(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, '_')
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`
}

function primitiveSchema(type: string): 'string' | 'number' | 'boolean' | 'object' {
  const lower = type.toLowerCase()
  if (lower.includes('int') || lower.includes('float') || lower.includes('double') || lower.includes('decimal') || lower.includes('numeric') || lower.includes('number')) return 'number'
  if (lower.includes('bool')) return 'boolean'
  if (lower.includes('json')) return 'object'
  return 'string'
}

function tsType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('int') || lower.includes('float') || lower.includes('double') || lower.includes('decimal') || lower.includes('numeric') || lower.includes('number')) return 'number'
  if (lower.includes('bool')) return 'boolean'
  if (lower.includes('json')) return 'Record<string, unknown>'
  if (lower.includes('date') || lower.includes('time')) return 'string'
  return 'string'
}

function pyType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('int') || lower.includes('float') || lower.includes('double') || lower.includes('decimal') || lower.includes('numeric') || lower.includes('number')) return 'float'
  if (lower.includes('bool')) return 'bool'
  if (lower.includes('json')) return 'dict[str, object]'
  return 'str'
}

function escapeTemplateLiteral(value: string): string {
  return value.replace(/`/g, '\`').replace(/\$\{/g, '\\${')
}

export function useApiExports() {
  const store = useApiStore()

  const exportTargets = computed(() => {
    if (store.mode === 'rest') {
      return [
        { id: 'openapi' as ApiExportTarget, label: EXPORT_TARGETS.openapi.label },
        { id: 'rest-ts-fetch' as ApiExportTarget, label: EXPORT_TARGETS['rest-ts-fetch'].label },
        { id: 'rest-js-fetch' as ApiExportTarget, label: EXPORT_TARGETS['rest-js-fetch'].label },
        { id: 'rest-python-fastapi' as ApiExportTarget, label: EXPORT_TARGETS['rest-python-fastapi'].label },
      ]
    }

    if (store.mode === 'graphql') {
      return [
        { id: 'graphql-sdl' as ApiExportTarget, label: EXPORT_TARGETS['graphql-sdl'].label },
        { id: 'graphql-resolvers-ts' as ApiExportTarget, label: EXPORT_TARGETS['graphql-resolvers-ts'].label },
        { id: 'graphql-resolvers-js' as ApiExportTarget, label: EXPORT_TARGETS['graphql-resolvers-js'].label },
      ]
    }

    return [
      { id: 'federation-sdl' as ApiExportTarget, label: EXPORT_TARGETS['federation-sdl'].label },
      { id: 'federation-subgraph-ts' as ApiExportTarget, label: EXPORT_TARGETS['federation-subgraph-ts'].label },
      { id: 'federation-subgraph-js' as ApiExportTarget, label: EXPORT_TARGETS['federation-subgraph-js'].label },
    ]
  })

  function exportTargetForMode(): ApiExportTarget {
    return exportTargets.value[0]?.id ?? 'openapi'
  }

  function exportTargetLabel(target: ApiExportTarget): string {
    return EXPORT_TARGETS[target].label
  }

  function exportDownloadName(target: ApiExportTarget): string {
    const base = store.project.name || 'api'
    return `${base}.${EXPORT_TARGETS[target].ext}`
  }

  function restTypes() {
    return store.restNodes.filter((node): node is RestTypeNode => node.kind === 'type')
  }

  function restEndpoints() {
    return store.restNodes.filter((node): node is RestEndpointNode => node.kind === 'endpoint')
  }

  function exportOpenApi(): string {
    const types = restTypes()
    const schemas = Object.fromEntries(
      types.map(type => [
        type.name,
        {
          type: 'object',
          description: type.description || undefined,
          properties: Object.fromEntries(
            type.fields.map(field => [
              field.name,
              {
                type: primitiveSchema(field.type),
                description: field.description || undefined,
              },
            ])
          ),
          required: type.fields.filter(field => field.required).map(field => field.name),
        },
      ])
    )

    const paths: Record<string, Record<string, unknown>> = {}

    for (const endpoint of restEndpoints()) {
      const requestType = endpoint.requestBodyRef ? types.find(type => type.id === endpoint.requestBodyRef) : undefined
      if (!paths[endpoint.path]) paths[endpoint.path] = {}
      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description || undefined,
        tags: endpoint.tags,
        parameters: endpoint.params
          .filter(param => param.in !== 'body')
          .map(param => ({
            name: param.name,
            in: param.in,
            required: param.required,
            description: param.description || undefined,
            schema: { type: primitiveSchema(param.type) },
          })),
        requestBody: requestType
          ? {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${requestType.name}` },
                },
              },
            }
          : undefined,
        responses: Object.fromEntries(
          endpoint.responses.map(response => {
            const responseType = response.bodyTypeRef ? types.find(type => type.id === response.bodyTypeRef) : undefined
            return [
              String(response.statusCode),
              {
                description: response.description,
                content: responseType
                  ? {
                      'application/json': {
                        schema: { $ref: `#/components/schemas/${responseType.name}` },
                      },
                    }
                  : undefined,
              },
            ]
          })
        ),
      }
    }

    return JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: store.project.rest.title || store.project.name,
        version: store.project.rest.version,
      },
      servers: [{ url: store.project.rest.baseUrl || '/api' }],
      paths,
      components: { schemas },
    }, null, 2)
  }

  function exportRestTsClient(): string {
    const types = restTypes()
    const lines: string[] = [
      `const API_BASE_URL = '${store.project.rest.baseUrl || '/api'}'`,
      '',
    ]

    for (const type of types) {
      lines.push(`export interface ${toPascalCase(type.name)} {`)
      for (const field of type.fields) {
        const optional = field.required ? '' : '?'
        lines.push(`  ${safeIdentifier(field.name)}${optional}: ${tsType(field.type)}`)
      }
      lines.push('}')
      lines.push('')
    }

    lines.push('async function request<T>(path: string, init?: RequestInit): Promise<T> {')
    lines.push('  const response = await fetch(`${API_BASE_URL}${path}`, {')
    lines.push("    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },")
    lines.push('    ...init,')
    lines.push('  })')
    lines.push('  if (!response.ok) throw new Error(`Request failed: ${response.status}`)')
    lines.push('  if (response.status === 204) return undefined as T')
    lines.push('  return response.json() as Promise<T>')
    lines.push('}')
    lines.push('')

    for (const endpoint of restEndpoints()) {
      const summaryBasis = endpoint.summary || `${endpoint.method} ${endpoint.path}`
      const fnName = toCamelCase(summaryBasis)
      const responseType = endpoint.responses.find(response => response.bodyTypeRef)?.bodyTypeRef
      const returnType = responseType ? toPascalCase(types.find(type => type.id === responseType)?.name || 'ResponseModel') : 'unknown'
      const requestType = endpoint.requestBodyRef ? types.find(type => type.id === endpoint.requestBodyRef) : undefined
      const args: string[] = []
      if (endpoint.params.length) args.push('params: Record<string, string | number | boolean | undefined>')
      if (requestType) args.push(`body: ${toPascalCase(requestType.name)}`)
      lines.push(`export async function ${fnName}(${args.join(', ')}): Promise<${returnType}> {`)
      if (endpoint.params.length) {
        lines.push('  const search = new URLSearchParams()')
        lines.push('  Object.entries(params).forEach(([key, value]) => {')
        lines.push('    if (value !== undefined) search.set(key, String(value))')
        lines.push('  })')
        lines.push("  const query = search.size ? `?${search.toString()}` : ''")
      } else {
        lines.push("  const query = ''")
      }
      lines.push(`  return request<${returnType}>('${endpoint.path}' + query, {`)
      lines.push(`    method: '${endpoint.method}',`)
      if (requestType) lines.push('    body: JSON.stringify(body),')
      lines.push('  })')
      lines.push('}')
      lines.push('')
    }

    return lines.join('\n')
  }

  function exportRestJsClient(): string {
    return exportRestTsClient()
      .replace(/export interface[\s\S]*?}\n\n/g, '')
      .replace(/async function request<T>\(path: string, init\?: RequestInit\): Promise<T>/, 'async function request(path, init = {})')
      .replace(/return undefined as T/g, 'return undefined')
      .replace(/return response.json\(\) as Promise<T>/g, 'return response.json()')
      .replace(/\(([^)]*): [^,)]+\)/g, '($1)')
      .replace(/: Promise<[^>]+>/g, '')
      .replace(/: Record<string, string \| number \| boolean \| undefined>/g, '')
      .replace(/: [A-Za-z0-9_<>, ?|\[\]]+/g, '')
  }

  function exportRestFastApi(): string {
    const lines: string[] = [
      'from fastapi import APIRouter',
      'from pydantic import BaseModel',
      '',
      `router = APIRouter(prefix='${store.project.rest.baseUrl || '/api'}')`,
      '',
    ]

    for (const type of restTypes()) {
      lines.push(`class ${toPascalCase(type.name)}(BaseModel):`)
      if (!type.fields.length) {
        lines.push('    pass')
      } else {
        for (const field of type.fields) {
          lines.push(`    ${safeIdentifier(field.name)}: ${pyType(field.type)}`)
        }
      }
      lines.push('')
    }

    for (const endpoint of restEndpoints()) {
      const summaryBasis = endpoint.summary || `${endpoint.method} ${endpoint.path}`
      const fnName = toCamelCase(summaryBasis)
      const requestType = endpoint.requestBodyRef ? restTypes().find(type => type.id === endpoint.requestBodyRef) : undefined
      const args: string[] = []
      if (requestType) args.push(`payload: ${toPascalCase(requestType.name)}`)
      lines.push(`@router.${endpoint.method.toLowerCase()}('${endpoint.path}')`)
      lines.push(`async def ${fnName}(${args.join(', ')}):`)
      lines.push(`    raise NotImplementedError('Implement ${endpoint.method} ${endpoint.path}')`)
      lines.push('')
    }

    return lines.join('\n')
  }

  function resolverStubLines(useTypes: boolean): string[] {
    const lines: string[] = useTypes ? ['export const resolvers = {'] : ['const resolvers = {']
    for (const node of store.gqlNodes) {
      if (!['type', 'query-root', 'mutation-root', 'subscription-root', 'interface'].includes(node.kind)) continue
      const typeName = node.kind === 'query-root' ? 'Query'
        : node.kind === 'mutation-root' ? 'Mutation'
        : node.kind === 'subscription-root' ? 'Subscription'
        : node.name
      lines.push(`  ${typeName}: {`)
      for (const field of node.fields) {
        const signature = useTypes
          ? `${safeIdentifier(field.name)}: async (_parent: unknown, _args: Record<string, unknown>, _ctx: unknown) => {`
          : `${safeIdentifier(field.name)}: async (_parent, _args, _ctx) => {`
        lines.push(`    ${signature}`)
        lines.push(`      throw new Error('Implement ${typeName}.${field.name}')`)
        lines.push('    },')
      }
      lines.push('  },')
    }
    lines.push('}')
    if (!useTypes) lines.push('', 'module.exports = { resolvers }')
    return lines
  }

  function exportGraphqlResolverStubsTs(): string {
    return resolverStubLines(true).join('\n')
  }

  function exportGraphqlResolverStubsJs(): string {
    return resolverStubLines(false).join('\n')
  }

  function federationTypeDefs(): string {
    return store.exportFedSdl()
  }

  function exportFederationSubgraph(useTypes: boolean): string {
    const lines: string[] = [
      "import { ApolloServer } from '@apollo/server'",
      "import { startStandaloneServer } from '@apollo/server/standalone'",
      "import { buildSubgraphSchema } from '@apollo/subgraph'",
      "import { parse } from 'graphql'",
      '',
      'const typeDefs = `',
      escapeTemplateLiteral(federationTypeDefs()),
      '`',
      '',
      useTypes ? 'const resolvers: Record<string, Record<string, unknown>> = {' : 'const resolvers = {',
    ]

    for (const service of store.fedServices) {
      lines.push(`  // ${service.name}`)
      for (const node of store.fedNodes.filter(candidate => candidate.serviceId === service.id)) {
        lines.push(`  ${node.name}: {`)
        for (const field of node.fields) {
          const signature = useTypes
            ? `${safeIdentifier(field.name)}: async (_parent: unknown, _args: Record<string, unknown>, _ctx: unknown) => {`
            : `${safeIdentifier(field.name)}: async (_parent, _args, _ctx) => {`
          lines.push(`    ${signature}`)
          lines.push(`      throw new Error('Implement ${service.name}.${node.name}.${field.name}')`)
          lines.push('    },')
        }
        if (node.isEntity) {
          const keyField = node.keyFields[0] || node.fields[0]?.name || 'id'
          const entitySignature = useTypes
            ? `__resolveReference: async (reference: Record<string, unknown>) => ({ ${safeIdentifier(keyField)}: reference.${safeIdentifier(keyField)} }),`
            : `__resolveReference: async (reference) => ({ ${safeIdentifier(keyField)}: reference.${safeIdentifier(keyField)} }),`
          lines.push(`    ${entitySignature}`)
        }
        lines.push('  },')
      }
    }

    lines.push('}')
    lines.push('')
    lines.push('async function startServer() {')
    lines.push('  const server = new ApolloServer({')
    lines.push("    schema: buildSubgraphSchema([{ typeDefs: parse(typeDefs), resolvers }]),")
    lines.push('  })')
    lines.push('')
    lines.push('  const { url } = await startStandaloneServer(server, { listen: { port: 4001 } })')
    lines.push("  console.log(`Subgraph ready at ${url}`)")
    lines.push('}')
    lines.push('')
    lines.push("startServer().catch(error => {")
    lines.push("  console.error('Failed to start subgraph server', error)")
    lines.push('})')

    return lines.join('\n')
  }

  function exportOutput(target: ApiExportTarget): string {
    if (target === 'openapi') return exportOpenApi()
    if (target === 'rest-ts-fetch') return exportRestTsClient()
    if (target === 'rest-js-fetch') return exportRestJsClient()
    if (target === 'rest-python-fastapi') return exportRestFastApi()
    if (target === 'graphql-sdl') return store.exportGqlSdl()
    if (target === 'graphql-resolvers-ts') return exportGraphqlResolverStubsTs()
    if (target === 'graphql-resolvers-js') return exportGraphqlResolverStubsJs()
    if (target === 'federation-sdl') return federationTypeDefs()
    if (target === 'federation-subgraph-ts') return exportFederationSubgraph(true)
    return exportFederationSubgraph(false)
  }

  return {
    exportTargets,
    exportTargetForMode,
    exportTargetLabel,
    exportDownloadName,
    exportOutput,
  }
}