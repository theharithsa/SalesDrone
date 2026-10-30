export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const resolveModel = (model) =>
  typeof model === "function" ? model() : model;
