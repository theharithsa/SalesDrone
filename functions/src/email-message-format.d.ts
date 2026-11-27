export function emailMessageBlocks(value: string): {
  kind: 'break' | 'list' | 'paragraph';
  lines: string[];
}[];
export function emailMessageRuns(value: string): {
  kind: 'bold' | 'italic' | 'text';
  text: string;
}[];
export function renderCorrespondenceV1(body: string): { text: string; html: string };
