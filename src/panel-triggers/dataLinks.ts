import { DataLink, LinkModel, ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { ProblemDTO } from '../datasource/types';

// Tag names may contain characters not allowed in variable names (".category", "interface-status"),
// so every non-alphanumeric character maps to an underscore: ${tag_interface_status}
export function tagNameToVariable(tag: string): string {
  return `tag_${tag.replace(/[^A-Za-z0-9]/g, '_')}`;
}

function getTagScopedVars(link: DataLink, problem: ProblemDTO): ScopedVars {
  const scopedVars: ScopedVars = {};

  // Tags referenced by the link but missing on the problem resolve to an empty string
  // instead of leaving the raw ${tag_*} text in the URL
  for (const match of `${link.title} ${link.url}`.matchAll(/\$\{?(tag_[A-Za-z0-9_]+)\}?/g)) {
    scopedVars[match[1]] = { text: '', value: '' };
  }

  // When several tags map to the same variable name, the alphabetically smallest value wins,
  // so the result doesn't depend on the tag order returned by the API
  const tagValues = new Map<string, string>();
  for (const tag of problem.tags ?? []) {
    const name = tagNameToVariable(tag.tag);
    const value = tag.value ?? '';
    const existing = tagValues.get(name);
    if (existing === undefined || value < existing) {
      tagValues.set(name, value);
    }
  }
  for (const [name, value] of tagValues) {
    scopedVars[name] = { text: name, value };
  }

  return scopedVars;
}

export function getProblemsDataLinks(links: DataLink[], problem: ProblemDTO): LinkModel[] {
  if (!links?.length) {
    return [];
  }

  const scopedVars: ScopedVars = {
    host: { text: 'host', value: problem.host ?? '' },
    description: { text: 'description', value: problem.description ?? '' },
    severity: { text: 'severity', value: String(problem.severity ?? '') },
    triggerid: { text: 'triggerid', value: problem.triggerid ?? '' },
    eventid: { text: 'eventid', value: problem.eventid ?? '' },
    name: { text: 'name', value: problem.name ?? '' },
  };

  return links.map((link) => {
    const linkScopedVars = { ...getTagScopedVars(link, problem), ...scopedVars };
    return {
      title: getTemplateSrv().replace(link.title, linkScopedVars),
      href: getTemplateSrv().replace(link.url, linkScopedVars),
      target: link.targetBlank ? '_blank' : '_self',
      origin: link,
    };
  });
}
