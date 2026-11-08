const setCmsText = (id, value) => {
  const element = document.getElementById(id);
  if (!element || typeof value !== 'string') return;
  element.textContent = value;
};

const loadCmsJson = async path => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} beim Laden von ${path}`);
  return response.json();
};

const loadHomeContent = async () => {
  try {
    const [home, trainer] = await Promise.all([
      loadCmsJson('data/home.json'),
      loadCmsJson('data/trainer.json')
    ]);
    setCmsText('hero-title-first', home.heroTitleFirst);
    setCmsText('hero-title-emphasis', home.heroTitleEmphasis);
    setCmsText('hero-description', home.heroDescription);
    setCmsText('welcome-title-first', home.welcomeTitleFirst);
    setCmsText('welcome-title-emphasis', home.welcomeTitleEmphasis);
    setCmsText('welcome-text', home.welcomeText);
    setCmsText('teaser-title-first', home.teaserTitleFirst);
    setCmsText('teaser-title-emphasis', home.teaserTitleEmphasis);
    setCmsText('teaser-text', home.teaserText);
    setCmsText('trainer-intro', trainer.intro);
  } catch (error) {
    console.error('CMS-Texte konnten nicht geladen werden; die HTML-Standardtexte bleiben sichtbar.', error);
  }
};

const renderCmsGallery = async () => {
  const gallery = document.getElementById('place-gallery');
  if (!gallery) return;

  try {
    const data = await loadCmsJson('data/gallery.json');
    if (!Array.isArray(data.images)) throw new TypeError('data/gallery.json muss ein images-Array enthalten.');
    const figures = data.images.map((item, index) => {
      if (!item || typeof item.image !== 'string' || typeof item.alt !== 'string') {
        throw new TypeError(`Galerieeintrag ${index + 1} benötigt Bildpfad und Alternativtext.`);
      }

      const figure = document.createElement('figure');
      figure.className = `gallery-item${index === 0 ? ' gallery-large' : ''}`;
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.alt;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `Bild vergrößern: ${item.alt || 'Golfplatzaufnahme'}`);
      image.title = 'Bild vergrößern';
      image.addEventListener('error', () => {
        image.hidden = true;
        figure.classList.add('is-empty');
      }, { once: true });
      figure.append(image);

      const fallback = document.createElement('span');
      fallback.className = 'image-fallback';
      fallback.textContent = item.alt || 'Golfplatzaufnahme';
      figure.append(fallback);
      return figure;
    });

    gallery.replaceChildren(...figures);
  } catch (error) {
    console.error('CMS-Galerie konnte nicht geladen werden; die bisherige Galerie bleibt sichtbar.', error);
  }
};

if (document.getElementById('hero-title-first')) loadHomeContent();
renderCmsGallery();
