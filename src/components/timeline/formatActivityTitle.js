// Title of the running timeline block: "App · Window title". Just the part that exists
// when one is empty; null when both are, so the caller's default text shows.
export default function formatActivityTitle(appWindow) {
  if (!appWindow) return null;
  const { app, title } = appWindow;
  if (app && title) return `${app} · ${title}`;
  return app || title || null;
}
