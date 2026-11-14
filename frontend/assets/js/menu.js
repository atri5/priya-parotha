const categoryNav = document.getElementById('menu-category-nav');
const sections = document.getElementById('menu-sections');
const status = document.getElementById('menu-status');
const retry = document.getElementById('menu-retry');
let publishedProducts = [];

function safePhoto(product) {
  const photo = product.photos?.find(value => typeof value === 'string');
  if (!photo) return null;
  try {
    const url = new URL(photo, location.origin);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname !== 'example.com' ? url.href : null;
  } catch {
    return null;
  }
}

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    : value;
}

function productCard(product) {
  const card = document.createElement('article');
  card.className = 'menu-card';
  const photo = safePhoto(product);
  if (photo) {
    const image = document.createElement('img');
    image.className = 'menu-card-image';
    image.src = photo;
    image.alt = `Photo of ${product.name}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => image.replaceWith(photoPlaceholder()));
    card.append(image);
  } else {
    card.append(photoPlaceholder());
  }

  const content = document.createElement('div');
  content.className = 'menu-card-content';
  const heading = document.createElement('div');
  heading.className = 'menu-card-heading';
  const name = document.createElement('h2');
  name.textContent = product.name;
  const price = document.createElement('p');
  price.className = 'menu-card-price body-5';
  price.textContent = formatPrice(product.price);
  heading.append(name, price);

  const description = document.createElement('p');
  description.className = 'menu-card-description body-6';
  description.textContent = product.desc;
  content.append(heading, description);
  card.append(content);
  return card;
}

function photoPlaceholder() {
  const placeholder = document.createElement('div');
  placeholder.className = 'menu-card-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  const flower = document.createElement('img');
  flower.src = 'assets/images/flower.svg';
  flower.alt = '';
  const label = document.createElement('span');
  label.className = 'caption-5';
  label.textContent = 'Photo coming soon';
  placeholder.append(flower, label);
  return placeholder;
}

function renderProducts() {
  const categories = new Map();
  publishedProducts.forEach(product => {
    const tags = product.tags.length ? product.tags : ['Uncategorized'];
    tags.forEach(tag => {
      if (!categories.has(tag)) categories.set(tag, []);
      categories.get(tag).push(product);
    });
  });

  const fragment = document.createDocumentFragment();
  const navigation = document.createDocumentFragment();
  [...categories.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([tag, products], index) => {
    const id = `menu-category-${index}`;
    const link = document.createElement('a');
    link.className = 'menu-category-link button-sm';
    link.href = `#${id}`;
    link.textContent = tag;
    navigation.append(link);

    const section = document.createElement('section');
    section.className = 'menu-category';
    section.id = id;
    section.setAttribute('aria-labelledby', `${id}-title`);
    const title = document.createElement('h2');
    title.className = 'heading-3 menu-category-title';
    title.id = `${id}-title`;
    title.textContent = tag;
    const grid = document.createElement('div');
    grid.className = 'menu-grid';
    grid.append(...products.map(productCard));
    section.append(title, grid);
    fragment.append(section);
  });

  sections.replaceChildren(fragment);
  categoryNav.replaceChildren(navigation);
  categoryNav.hidden = categories.size === 0;
  status.hidden = publishedProducts.length > 0;
  if (!publishedProducts.length) {
    status.textContent = 'Our menu is being prepared. Please check back soon.';
  }
}

async function loadMenu() {
  status.hidden = false;
  status.textContent = 'Loading menu…';
  retry.hidden = true;
  sections.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Could not load the menu. Please try again.');
    const products = await response.json();
    if (!Array.isArray(products)) throw new Error('The menu could not be displayed. Please try again.');
    publishedProducts = products
      .filter(product => product?.published === true)
      .map(product => ({
        ...product,
        tags: Array.isArray(product.tags) ? product.tags.filter(tag => typeof tag === 'string') : [],
      }));

    renderProducts();
  } catch (error) {
    status.textContent = error.message || 'Could not load the menu. Please try again.';
    retry.hidden = false;
    categoryNav.replaceChildren();
    categoryNav.hidden = true;
    sections.replaceChildren();
  } finally {
    sections.setAttribute('aria-busy', 'false');
  }
}

retry.addEventListener('click', loadMenu);
loadMenu();