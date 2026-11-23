// Die Originalbilder bleiben im Website-Ordner; Netlify optimiert sie über das Image CDN.
// Das Drohnenvideo kann später als optimierte MP4-Datei in images/video/ ergänzt werden.
window.MEDIA_URLS = {
  whatsappNumber: '4915154998883',
  netlifyImageCdn: true,
  heroVideo: '',
  heroPoster: 'images/golfplatz/21-13.png',
  homePanorama: 'images/golfplatz/9-_DSC4656.jpg',
  trainerPortrait: 'images/oliver/28-DSC00115.jpg',
  placePanorama: 'images/golfplatz/22-DJI_20260912174423_0003_D.png',
  placeFairway: 'images/golfplatz/21-13.png',
  placeGreen: 'images/golfplatz/19-10.png',
  placeTraining: 'images/golfplatz/9-_DSC4656.jpg',
  trainingHeader: 'images/golfplatz/9-_DSC4656.jpg',
  placeHeader: 'images/golfplatz/19-10.png',
  trainerGallery: [
    'images/oliver/28-DSC00115.jpg',
    'images/oliver/29-DSC00124.jpg'
  ]
};

const isLocalMediaPreview = window.location.protocol === 'file:' ||
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

window.getMediaImageUrl = (path, width = 1600) => {
  const source = new URL(path, window.location.href);
  if (!window.MEDIA_URLS.netlifyImageCdn || isLocalMediaPreview) return source.href;

  const parameters = new URLSearchParams({
    url: source.pathname,
    w: String(width),
    q: '75'
  });
  return `/.netlify/images?${parameters}`;
};

window.setResponsiveMediaImage = (image, path, widths, sizes) => {
  const source = new URL(path, window.location.href).href;
  const useImageCdn = window.MEDIA_URLS.netlifyImageCdn && !isLocalMediaPreview;
  let triedOriginal = !useImageCdn;

  image.dataset.mediaOriginal = source;
  image.addEventListener('error', () => {
    if (!triedOriginal) {
      triedOriginal = true;
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = source;
      return;
    }
    image.parentElement?.remove();
  });

  if (useImageCdn) {
    image.sizes = sizes;
    image.srcset = widths.map(width => `${window.getMediaImageUrl(path, width)} ${width}w`).join(', ');
    image.src = window.getMediaImageUrl(path, widths[Math.min(1, widths.length - 1)]);
  } else {
    image.src = source;
  }
};
