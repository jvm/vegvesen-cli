import { writeFileSync } from 'node:fs';
import { commandRegistry } from '../dist/registry.js';

const groups = new Map();
for (const command of commandRegistry) { const group = command.path.split(' ')[0]; groups.set(group, [...(groups.get(group) ?? []), command]); }
let output = '# Command reference\n\nGenerated from the same registry used by `vegvesen schema command`.\n\n';
for (const [group, commands] of groups) {
  output += `## ${group}\n\n`;
  for (const command of commands) output += `- \`vegvesen ${command.path}\` — ${command.description}\n`;
  output += '\n';
}
writeFileSync(new URL('../COMMANDS.md', import.meta.url), output);
console.log(`Generated ${commandRegistry.length} command entries`);
