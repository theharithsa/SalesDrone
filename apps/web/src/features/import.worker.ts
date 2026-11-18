/// <reference lib="webworker" />
import { readWorkbook } from './read-workbook';

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ sheets: await readWorkbook(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not read workbook' });
  }
};
