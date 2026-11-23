const cmsPageFiles = {
  'index.html': 'home',
  'training.html': 'training',
  'ueber-mich.html': 'trainer',
  'golfplatz.html': 'golfplatz',
  'kontakt.html': 'contact',
  'impressum.html': 'impressum',
  'datenschutz.html': 'datenschutz'
};

const cmsPage = cmsPageFiles[window.location.pathname.split('/').pop() || 'index.html'];
const cmsTitleFields = {
  home: 'pageTitleHome',
  training: 'pageTitleTraining',
  golfplatz: 'pageTitleGolfplatz',
  contact: 'pageTitleKontakt',
  impressum: 'pageTitleImpressum',
  datenschutz: 'pageTitleDatenschutz'
};

const loadCmsJson = async name => {
  try {
    const saved = JSON.parse(localStorage.getItem('oe-site-content-v1') || 'null');
    if (saved && saved[name] && typeof saved[name] === 'object') return saved[name];
  } catch (error) {
    console.warn('Lokal gespeicherte Website-Inhalte konnten nicht gelesen werden.', error);
  }
  const response = await fetch(`data/${name}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} beim Laden von data/${name}.json`);
  return response.json();
};

const getCmsValue = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);

const applyCmsText = (data, selector, attribute, targetAttribute) => {
  document.querySelectorAll(selector).forEach(element => {
    const value = getCmsValue(data, element.getAttribute(attribute));
    if (typeof value !== 'string') return;
    if (targetAttribute) element.setAttribute(targetAttribute, value);
    else element.textContent = value;
  });
};

const renderCmsGallery = (gallery, targetId) => {
  const container = document.getElementById(targetId);
  if (!container) return;
  if (!Array.isArray(gallery)) throw new TypeError(`${targetId} muss eine Bildliste sein.`);

  const figures = gallery.map((item, index) => {
    if (!item || typeof item.image !== 'string' || typeof item.alt !== 'string') {
      throw new TypeError(`Galerieeintrag ${index + 1} benötigt Bildpfad und Alternativtext.`);
    }

    const figure = document.createElement('figure');
    figure.className = `gallery-item${index === 0 && targetId === 'place-gallery' ? ' gallery-large' : ''}`;
    const image = document.createElement('img');
    image.alt = item.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    window.setResponsiveMediaImage(image, item.image, [480, 800, 1200], '(max-width: 700px) 100vw, 380px');
    if (targetId === 'place-gallery') {
      const button = document.createElement('button');
      button.className = 'gallery-image-button';
      button.type = 'button';
      button.setAttribute('aria-label', `Bild vergrößern: ${item.alt}`);
      button.append(image);
      figure.append(button);
    } else {
      figure.append(image);
    }
    return figure;
  });

  container.replaceChildren(...figures);
};

const renderCareerTimeline = career => {
  const timeline = document.querySelector('.career-timeline');
  if (!timeline || !Array.isArray(career)) return;
  const entries = career
    .filter(entry => entry && typeof entry.year === 'string' && Array.isArray(entry.achievements))
    .sort((a, b) => Number.parseInt(b.year, 10) - Number.parseInt(a.year, 10));
  timeline.replaceChildren(...entries.map(entry => {
    const item = document.createElement('li');
    item.className = 'career-timeline-item';
    const year = document.createElement('span');
    year.className = 'career-year';
    year.textContent = entry.year;
    const content = document.createElement('div');
    const achievements = document.createElement('ul');
    entry.achievements.filter(text => typeof text === 'string').forEach(text => {
      const achievement = document.createElement('li');
      achievement.textContent = text;
      achievements.append(achievement);
    });
    content.append(achievements);
    item.append(year, content);
    return item;
  }));
  window.refreshCareerTimeline?.();
};

const linkifyText = (container, text) => {
  const linkPattern = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|https:\/\/[^\s]+/g;
  let start = 0;

  for (const match of text.matchAll(linkPattern)) {
    container.append(document.createTextNode(text.slice(start, match.index)));
    const link = document.createElement('a');
    const rawUrl = match[2] || match[0];
    link.href = rawUrl.replace(/[.,;]+$/, '');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = match[1] || link.href;
    container.append(link);
    if (!match[2] && link.href.length < match[0].length) {
      container.append(document.createTextNode(match[0].slice(link.href.length)));
    }
    start = match.index + match[0].length;
  }

  container.append(document.createTextNode(text.slice(start)));
};

const renderLegalPage = data => {
  const container = document.getElementById('legal-content');
  if (!container || !Array.isArray(data.sections)) return;

  const title = container.querySelector('[data-cms-legal-title]');
  const eyebrow = container.querySelector('[data-cms-legal-eyebrow]');
  const notice = container.querySelector('[data-cms-legal-notice]');
  if (title && typeof data.title === 'string') title.textContent = data.title;
  if (eyebrow && typeof data.eyebrow === 'string') eyebrow.textContent = data.eyebrow;
  const noticeContent = notice && typeof data.notice === 'string' && data.notice ? notice : null;
  if (noticeContent) noticeContent.textContent = data.notice;
  else if (notice) notice.remove();

  const content = data.sections.map(section => {
    if (!section || typeof section.heading !== 'string' || typeof section.body !== 'string') {
      throw new TypeError('Jeder Rechtsabschnitt benötigt eine Überschrift und einen Text.');
    }
    const fragment = document.createDocumentFragment();
    const heading = document.createElement('h2');
    heading.textContent = section.heading;
    fragment.append(heading);
    section.body.split(/\n{2,}/).forEach(paragraphText => {
      const paragraph = document.createElement('p');
      paragraph.style.whiteSpace = 'pre-line';
      linkifyText(paragraph, paragraphText);
      fragment.append(paragraph);
    });
    return fragment;
  });
  container.replaceChildren(eyebrow, title, ...(noticeContent ? [noticeContent] : []), ...content);
};

const loadSiteSettings = async () => {
  try {
    const settings = await loadCmsJson('settings');
    applyCmsText(settings, '[data-cms-global]', 'data-cms-global');
    const title = settings[cmsTitleFields[cmsPage]];
    if (typeof title === 'string') document.title = title;
  } catch (error) {
    console.error('Website-Einstellungen konnten nicht geladen werden; die HTML-Standardtexte bleiben sichtbar.', error);
  }
};

const loadPageContent = async () => {
  if (!cmsPage) return;
  try {
    const data = await loadCmsJson(cmsPage);
    window.CMS_PAGE_DATA = data;
    if (cmsPage === 'home' || cmsPage === 'trainer') {
      const trainer = await loadCmsJson('trainer');
      const intro = document.getElementById('trainer-intro');
      if (intro && typeof trainer.intro === 'string') intro.textContent = trainer.intro;
      const aboutIntro = document.querySelector('[data-cms-trainer-intro]');
      if (aboutIntro && typeof trainer.intro === 'string') aboutIntro.textContent = trainer.intro;
      const trainerName = document.querySelector('[data-cms-trainer-name]');
      if (trainerName && typeof trainer.name === 'string') trainerName.textContent = trainer.name;
      if (cmsPage === 'trainer') renderCareerTimeline(trainer.career);
    }
    applyCmsText(data, '[data-cms]', 'data-cms');
    applyCmsText(data, '[data-cms-placeholder]', 'data-cms-placeholder', 'placeholder');
    applyCmsText(data, '[data-cms-alt]', 'data-cms-alt', 'alt');

    const benefits = document.getElementById('training-benefits');
    if (benefits && Array.isArray(data.offer?.benefits)) {
      benefits.replaceChildren(...data.offer.benefits.map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
    }
    const individualBenefits = document.getElementById('individual-benefits');
    if (individualBenefits && Array.isArray(data.individual?.benefits)) {
      individualBenefits.replaceChildren(...data.individual.benefits.map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
    }

    if (data.packageTraining) {
      const option = document.getElementById('package-training');
      if (option) option.textContent = data.packageTraining;
    }
    if (data.packageGeneral) {
      const option = document.getElementById('package-general');
      if (option) option.textContent = data.packageGeneral;
    }
    if (typeof data.phoneOptional === 'string') {
      const optional = document.querySelector('[data-cms-phone-optional]');
      if (optional) optional.textContent = data.phoneOptional;
    }
    const mapBox = document.getElementById('map-box');
    if (mapBox && data.directions) {
      const mapTitle = mapBox.querySelector('.map-placeholder h3');
      const mapHint = mapBox.querySelector('.map-placeholder p');
      const mapButton = mapBox.querySelector('#load-map');
      if (mapTitle && typeof data.directions.mapTitle === 'string') mapTitle.textContent = data.directions.mapTitle;
      if (mapHint && typeof data.directions.mapHint === 'string') mapHint.textContent = data.directions.mapHint;
      if (mapButton && typeof data.directions.mapButton === 'string' && mapButton.firstChild) {
        mapButton.firstChild.nodeValue = `${data.directions.mapButton} `;
      }
    }

    if (data.sections) renderLegalPage(data);
  } catch (error) {
    console.error(`CMS-Inhalte für ${cmsPage} konnten nicht geladen werden; die HTML-Standardtexte bleiben sichtbar.`, error);
  }
};

const loadGalleries = async () => {
  if (!document.getElementById('place-gallery') && !document.getElementById('trainer-gallery')) return;
  try {
    const gallery = await loadCmsJson('gallery');
    renderCmsGallery(Array.isArray(gallery.placeImages) ? gallery.placeImages : [], 'place-gallery');
    renderCmsGallery(Array.isArray(gallery.trainerImages) ? gallery.trainerImages : [], 'trainer-gallery');
  } catch (error) {
    console.error('CMS-Galerien konnten nicht geladen werden; die vorhandenen Bilder bleiben sichtbar.', error);
  }
};

Promise.all([loadSiteSettings(), loadPageContent(), loadGalleries()]).finally(() => {
  document.documentElement.classList.remove('cms-loading');
});
