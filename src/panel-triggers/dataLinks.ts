import { DataLink, LinkModel, ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { ProblemDTO } from '../datasource/types'; 

export function getProblemsDataLinks(links: DataLink[], problem: ProblemDTO): LinkModel[] {
  if (!links?.length) {
    return [];
  }

  const scopedVars: ScopedVars = {
    host:        { text: 'host',        value: problem.host ?? '' },
    description: { text: 'description', value: problem.description ?? '' },
    severity:    { text: 'severity',    value: String(problem.severity ?? '') },
    triggerid:   { text: 'triggerid',   value: problem.triggerid ?? '' },
    eventid:     { text: 'eventid',     value: problem.eventid ?? '' },
    name:        { text: 'name',        value: problem.name ?? '' },
  };

  return links.map((link) => ({
    title:  getTemplateSrv().replace(link.title, scopedVars),
    href:   getTemplateSrv().replace(link.url, scopedVars),
    target: link.targetBlank ? '_blank' : '_self',
    origin: link,
  }));
}
