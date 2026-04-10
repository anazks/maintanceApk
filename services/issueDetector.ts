import Fuse from 'fuse.js';

const troubleshootingData = require('../assets/troubleshooting.json');

export interface TroubleshootingStep {
  id: number;
  question: string;
  yes: number | string;
  no: number | string;
}

export interface TroubleshootingIssue {
  id: string;
  keywords: string[];
  steps: TroubleshootingStep[];
  searchText?: string;
}

const issues: TroubleshootingIssue[] = troubleshootingData.map((i: any) => ({
  ...i,
  searchText: i.keywords.join(' '),
}));

const fuse = new Fuse(issues, {
  keys: ['searchText'],
  threshold: 0.4,
});

export function detectIssue(input: string): TroubleshootingIssue | null {
  const result = fuse.search(input);
  return result.length > 0 ? result[0].item : null;
}
