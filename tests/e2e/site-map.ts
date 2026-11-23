export const siteMap = [
  '/',
  '/ueber-mich.html',
  '/training.html',
  '/golfplatz.html',
  '/kontakt.html',
  '/impressum.html',
  '/datenschutz.html'
] as const;

export const visualRoutes = [
  { path: '/', name: 'home' },
  { path: '/ueber-mich.html', name: 'ueber-mich' },
  { path: '/training.html', name: 'training' },
  { path: '/golfplatz.html', name: 'golfplatz' },
  { path: '/kontakt.html', name: 'kontakt' },
  { path: '/impressum.html', name: 'impressum' },
  { path: '/datenschutz.html', name: 'datenschutz' }
] as const;
