/// <reference lib="webworker" />
import { buildReportWorkbook } from './report-workbook';
self.onmessage = async (e) => {
  try {
    const buffer = await buildReportWorkbook(e.data);
    self.postMessage({ buffer }, [buffer]);
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
