export function renderSafely(render, fallback, label, logger = console.error) {
  try {
    return render();
  } catch (error) {
    logger(`Failed to render ${label}.`, error);
    return fallback;
  }
}
