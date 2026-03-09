// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Shared geometry / canvas Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface Position { x: number; y: number }
export interface Size     { w: number; h: number }
export interface Rect     { x: number; y: number; w: number; h: number }

export type DesignerMode = 'rest' | 'graphql' | 'federation'
export type ApiExportTarget =
  | 'openapi'
  | 'rest-ts-fetch'
  | 'rest-js-fetch'
  | 'rest-python-fastapi'
  | 'graphql-sdl'
  | 'graphql-resolvers-ts'
  | 'graphql-resolvers-js'
  | 'federation-sdl'
  | 'federation-subgraph-ts'
  | 'federation-subgraph-js'

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ REST Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RestParam {
  id: string
  name: string
  in: 'path' | 'query' | 'header' | 'body'
  type: string
  required: boolean
  description: string
}

export interface RestResponse {
  id: string
  statusCode: number
  description: string
  bodyTypeRef: string | null   // references a RestTypeNode id
}

export interface RestEndpointNode {
  id: string
  kind: 'endpoint'
  method: HttpMethod
  path: string
  summary: string
  description: string
  tags: string[]
  params: RestParam[]
  responses: RestResponse[]
  requestBodyRef: string | null  // references a RestTypeNode id
  position: Position
  width: number
  color: string
  groupId: string | null
}

export interface RestTypeNode {
  id: string
  kind: 'type'
  name: string
  description: string
  fields: RestField[]
  position: Position
  width: number
  color: string
  groupId: string | null
}

export interface RestField {
  id: string
  name: string
  type: string       // primitive or ref to another RestTypeNode name
  required: boolean
  description: string
}

export type RestNode = RestEndpointNode | RestTypeNode

export type RestRelationKind = 'request-body' | 'response-body' | 'type-ref'

export interface RestRelation {
  id: string
  kind: RestRelationKind
  sourceId: string
  targetId: string
  label: string
}

export interface RestSchema {
  id: string
  title: string
  version: string
  baseUrl: string
  nodes: RestNode[]
  relations: RestRelation[]
  groups: ApiGroup[]
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ GraphQL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export type GqlTypeKind = 'type' | 'input' | 'enum' | 'interface' | 'union' | 'scalar' | 'query-root' | 'mutation-root' | 'subscription-root'

export interface GqlField {
  id: string
  name: string
  type: string          // e.g. "String!", "[User!]!", "ID"
  description: string
  isDeprecated: boolean
  args: GqlArg[]
  resolverRef: string | null  // for Query/Mutation/Subscription fields
}

export interface GqlArg {
  id: string
  name: string
  type: string
  defaultValue: string
  description: string
}

export interface GqlTypeNode {
  id: string
  kind: GqlTypeKind
  name: string
  description: string
  fields: GqlField[]
  implements: string[]   // interface names
  values: string[]       // for enums
  position: Position
  width: number
  color: string
  groupId: string | null
}

export type GqlRelationKind = 'field-ref' | 'implements' | 'union-member'

export interface GqlRelation {
  id: string
  kind: GqlRelationKind
  sourceId: string
  sourceFieldId: string | null
  targetId: string
  label: string
}

export interface GqlSchema {
  id: string
  name: string
  nodes: GqlTypeNode[]
  relations: GqlRelation[]
  groups: ApiGroup[]
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ GraphQL Federation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface FedService {
  id: string
  name: string
  url: string
  color: string
  position: Position
  size: Size
}

export interface FedTypeNode {
  id: string
  serviceId: string       // which service owns this type
  name: string
  description: string
  isEntity: boolean       // true = has @key directive
  keyFields: string[]     // fields named in @key(fields: "...")
  isExtension: boolean    // extend type
  fields: FedField[]
  position: Position
  width: number
  color: string
  groupId: string | null
}

export interface FedField {
  id: string
  name: string
  type: string
  isExternal: boolean    // @external
  isRequired: boolean    // @requires
  requiresFields: string
  isKey: boolean         // part of @key
  description: string
}

export type FedRelationKind = 'entity-reference' | 'field-ref' | 'extends'

export interface FedRelation {
  id: string
  kind: FedRelationKind
  sourceServiceId: string
  sourceTypeId: string
  sourceFieldId: string | null
  targetServiceId: string
  targetTypeId: string
  label: string
}

export interface FedSchema {
  id: string
  name: string
  services: FedService[]
  nodes: FedTypeNode[]
  relations: FedRelation[]
  groups: ApiGroup[]
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Shared group (same concept as DB modeler) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface ApiGroup {
  id: string
  name: string
  color: string
  position: Position
  size: Size
  parentGroupId: string | null
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Project (top-level, holds all three schemas + mode) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface ApiProject {
  id: string
  name: string
  mode: DesignerMode
  rest: RestSchema
  graphql: GqlSchema
  federation: FedSchema
  linkedDbSchemaPath: string | null  // optional path to a .dbm.json
  createdAt: string
  updatedAt: string
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Canvas constants Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const NODE_MIN_WIDTH  = 260
export const NODE_DEFAULT_WIDTH = 320
export const NODE_HEADER_H   = 46
export const NODE_FIELD_H    = 32
export const NODE_FOOTER_H   = 28
export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    '#3ECF8E',
  POST:   '#2FBF8F',
  PUT:    '#58C98D',
  PATCH:  '#8ACB88',
  DELETE: '#E0705E',
}
export const GQL_KIND_COLORS: Record<GqlTypeKind, string> = {
  'type':              '#3ECF8E',
  'input':             '#57C5A0',
  'enum':              '#D5A35B',
  'interface':         '#56B8A6',
  'union':             '#7BC98F',
  'scalar':            '#A6D97A',
  'query-root':        '#3ECF8E',
  'mutation-root':     '#E0705E',
  'subscription-root': '#D5A35B',
}

