// Title of the running timeline block: "App · Window title" (just "App" without a title).
export default function formatActivityTitle(appWindow) {
  if (!appWindow) return null;
  const { app, title } = appWindow;
  return title ? `${app} · ${title}` : app;
}
