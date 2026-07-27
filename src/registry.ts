export interface CommandDefinition {
  path: string;
  description: string;
  class: 'query' | 'config' | 'artifact';
  service: string;
  arguments?: Array<{ name: string; required: boolean; description: string }>;
  options?: Array<{ name: string; description: string; required?: boolean; choices?: string[] }>;
}

export const commandRegistry: CommandDefinition[] = [
  { path: 'version', description: 'Show CLI and machine-contract versions', class: 'query', service: 'local' },
  { path: 'doctor', description: 'Check local readiness and service health gates', class: 'query', service: 'local' },
  { path: 'service list', description: 'List known services and support states', class: 'query', service: 'local' },
  { path: 'service get', description: 'Get exact service metadata', class: 'query', service: 'local', arguments: [{ name: 'service', required: true, description: 'Exact service ID' }] },
  { path: 'schema command', description: 'Describe command contract metadata', class: 'query', service: 'local' },
  { path: 'schema output', description: 'Show output JSON Schema', class: 'query', service: 'local', arguments: [{ name: 'command-path', required: false, description: 'Optional command path' }] },
  { path: 'config path', description: 'Show user config path', class: 'query', service: 'local' },
  { path: 'config show', description: 'Show config and effective sources', class: 'query', service: 'local' },
  { path: 'config validate', description: 'Validate user config', class: 'query', service: 'local' },
  { path: 'config set', description: 'Set an allowlisted non-sensitive value', class: 'config', service: 'local', arguments: [{ name: 'key', required: true, description: 'Allowlisted key' }, { name: 'value', required: true, description: 'Value' }] },
  { path: 'config unset', description: 'Remove an allowlisted value', class: 'config', service: 'local', arguments: [{ name: 'key', required: true, description: 'Allowlisted key' }] },
  { path: 'catalog package search', description: 'Search catalog packages', class: 'query', service: 'catalog' },
  { path: 'catalog package get', description: 'Get exact package', class: 'query', service: 'catalog' },
  { path: 'catalog resource get', description: 'Get exact package resource', class: 'query', service: 'catalog' },
  { path: 'catalog group list', description: 'List catalog groups', class: 'query', service: 'catalog' },
  { path: 'catalog group get', description: 'Get exact catalog group', class: 'query', service: 'catalog' },
  { path: 'catalog organization list', description: 'List catalog organizations', class: 'query', service: 'catalog' },
  { path: 'catalog organization get', description: 'Get exact catalog organization', class: 'query', service: 'catalog' },
  { path: 'catalog tag list', description: 'List catalog tags', class: 'query', service: 'catalog' },
  { path: 'catalog tag get', description: 'Get exact catalog tag', class: 'query', service: 'catalog' },
  { path: 'catalog status get', description: 'Get catalog status', class: 'query', service: 'catalog' },
  { path: 'nvdb catalog version', description: 'Get active NVDB catalog version', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog type list', description: 'List NVDB object types', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog type get', description: 'Get exact NVDB object type', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog type history', description: 'Get object types at catalog version', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog property get', description: 'Get exact NVDB property type', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog property categories', description: 'List NVDB property categories', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog product-spec get', description: 'Get object type product specification', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog category list', description: 'List NVDB object categories', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb catalog unit list', description: 'List NVDB units', class: 'query', service: 'nvdb-catalog' },
  { path: 'nvdb area county list', description: 'List counties', class: 'query', service: 'nvdb-areas' },
  { path: 'nvdb area municipality list', description: 'List municipalities', class: 'query', service: 'nvdb-areas' },
  { path: 'nvdb area road-authority list', description: 'List road authorities', class: 'query', service: 'nvdb-areas' },
  { path: 'nvdb area national-route list', description: 'List national routes', class: 'query', service: 'nvdb-areas' },
  { path: 'nvdb area contract list', description: 'List contract areas', class: 'query', service: 'nvdb-areas' },
  { path: 'nvdb area address list', description: 'List addresses', class: 'query', service: 'nvdb-areas' },
  { path: 'parking provider list', description: 'List parking providers', class: 'query', service: 'parking' },
  { path: 'parking provider get', description: 'Get provider by organization number', class: 'query', service: 'parking' },
  { path: 'parking provider active', description: 'List active parking providers', class: 'query', service: 'parking' },
  { path: 'parking area list', description: 'List parking areas', class: 'query', service: 'parking' },
  { path: 'parking area get', description: 'Get exact parking area', class: 'query', service: 'parking' },
  { path: 'parking area version', description: 'Get exact parking area version', class: 'query', service: 'parking' },
  { path: 'parking sign-plan get', description: 'Get sign-plan attachment', class: 'artifact', service: 'parking' },
  { path: 'parking assessment get', description: 'Get assessment attachment', class: 'artifact', service: 'parking' },
  { path: 'nvdb status current', description: 'Get NVDB system status', class: 'query', service: 'nvdb-status' },
  { path: 'nvdb status dependency list', description: 'List NVDB systems and services', class: 'query', service: 'nvdb-status' },
  { path: 'nvdb status message list', description: 'List NVDB status messages', class: 'query', service: 'nvdb-status' },
  { path: 'nvdb status message get', description: 'Get exact NVDB status message', class: 'query', service: 'nvdb-status' }
];
