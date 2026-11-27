const views = {
  dashboard: ['Dashboard', 'Welcome to your kitchen workspace.', 'Your kitchen at a glance', 'Your overview will live here. Use the sidebar to explore the workspace.'],
  'create-product': ['Create Product', 'Make room for something delicious.', 'New dishes start here', 'Product creation is coming soon.'],
  'manage-products': ['Products', 'A home for the dishes you share.', 'Your menu, together', 'Product management is coming soon.'],
  'manage-accounts': ['Manage Accounts', 'The people behind your kitchen.', 'A space for your team', 'Account management is coming soon.'],
  orders: ['Orders', 'Keep track of what’s cooking.', 'Every order in one place', 'Order management is coming soon.'],
  stats: ['Stats', 'See how your kitchen is doing.', 'Get to know your business', 'Business statistics are coming soon.'],
};

function showView() {
  const key = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  ['view-title', 'view-description', 'placeholder-title', 'placeholder-description'].forEach((id, index) => { document.getElementById(id).textContent = views[key][index]; });
  document.querySelector('.dashboard-placeholder').hidden = ['manage-products', 'create-product'].includes(key);
  document.getElementById('create-product-form').hidden = key !== 'create-product';
  document.getElementById('products-view').hidden = key !== 'manage-products';
  document.getElementById('add-product').hidden = key !== 'manage-products';
  document.getElementById('product-back').hidden = key !== 'create-product';
  document.title = `${views[key][0]} | Priya Parotha`;
  document.querySelectorAll('.dashboard-nav a').forEach(link => {
    if (link.hash === `#${key === 'create-product' ? 'manage-products' : key}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (['create-product', 'manage-products', 'manage-accounts'].includes(key)) document.getElementById('manage-menu').open = true;
  if (key === 'create-product') loadTags();
}
window.addEventListener('hashchange', () => { showView(); document.getElementById('main').focus({ preventScroll: true }); });
const productForm = document.getElementById('create-product-form');
const imageInput = document.getElementById('product-images');
const dropzone = document.getElementById('image-dropzone');
const imageError = document.getElementById('image-error');
const previews = document.getElementById('image-previews');
const formStatus = document.getElementById('product-form-status');
const selectedImages = [];
let creatingProduct = false;
function renderImages() {
  previews.replaceChildren();
  selectedImages.forEach(({ file, url }, index) => {
    const item = document.createElement('li');
    const image = document.createElement('img'); image.src = url; image.alt = `Preview of ${file.name}`;
    const name = document.createElement('p'); name.className = 'caption-2'; name.textContent = file.name;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button-sm'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(url); selectedImages.splice(index, 1); renderImages(); formStatus.textContent = '';
      (previews.querySelector('button') || imageInput).focus();
    });
    item.append(image, name, remove); previews.append(item);
  });
  document.getElementById('image-count').textContent = `${selectedImages.length} images selected.`;
}
function addImages(files) {
  if (creatingProduct) return;
  const errors = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) errors.push(`${file.name}: choose a JPG, PNG, or WebP image up to 10 MB.`);
    else if (!selectedImages.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) selectedImages.push({ file, url: URL.createObjectURL(file) });
  }
  imageError.textContent = errors.join(' '); formStatus.textContent = ''; renderImages();
}
imageInput.addEventListener('change', () => { addImages(imageInput.files); imageInput.value = ''; });
let dragDepth = 0;
dropzone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; dropzone.classList.add('is-dragging'); });
dropzone.addEventListener('dragover', event => event.preventDefault());
dropzone.addEventListener('dragleave', () => { if (--dragDepth <= 0) dropzone.classList.remove('is-dragging'); });
dropzone.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; dropzone.classList.remove('is-dragging'); addImages(event.dataTransfer.files); });
productForm.addEventListener('input', event => {
  formStatus.textContent = '';
  if (['name', 'desc'].includes(event.target.name)) event.target.setCustomValidity(event.target.value.trim() ? '' : 'Enter a value containing more than spaces.');
});
productForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (creatingProduct) return;
  if (selectedImages.length > 10 || selectedImages.reduce((sum, item) => sum + item.file.size, 0) > 20 * 1024 * 1024) { imageError.textContent = 'Choose up to 10 images totaling no more than 20 MB.'; imageInput.focus(); return; }
  imageError.textContent = '';
  const body = new FormData(productForm);
  selectedImages.forEach(({ file }) => body.append('photos', file));
  const controls = [...productForm.querySelectorAll('input, textarea, button')];
  const submit = productForm.querySelector('[type="submit"]');
  creatingProduct = true; controls.forEach(control => { control.disabled = true; }); submit.textContent = 'Creating product…'; productForm.setAttribute('aria-busy', 'true'); formStatus.textContent = 'Creating your product…';
  try {
    const response = await fetch('/api/products', { method: 'POST', headers: { 'X-Product-Request': 'create' }, body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not create product.');
    productForm.reset(); initTagEditor(productForm.querySelector('.tags-editor')); selectedImages.forEach(({ url }) => URL.revokeObjectURL(url)); selectedImages.length = 0; renderImages(); formStatus.textContent = '';
    document.getElementById('product-created-status').textContent = `${result.name} was created.`;
    location.hash = 'manage-products'; await loadProducts();
  } catch (error) { formStatus.textContent = error.message; }
  finally { creatingProduct = false; controls.forEach(control => { control.disabled = false; }); submit.textContent = 'Create product'; productForm.setAttribute('aria-busy', 'false'); }
});
async function loadTags() {
  const options = document.getElementById('product-tags');
  const status = document.getElementById('tag-status'); status.textContent = 'Loading categories…';
  try {
    const response = await fetch('/api/tags');
    if (!response.ok) throw new Error();
    const tags = await response.json();
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) throw new Error();
    options.replaceChildren(...tags.map(tag => { const option = document.createElement('option'); option.value = tag; return option; }));
    status.textContent = tags.length ? 'Existing categories are available as you type.' : 'No categories yet. Type a tag to start one.';
  } catch { status.textContent = 'Categories could not be loaded. You can still type a tag.'; }
}
let productCards = [];
const savedProducts = new Map();
const selectedPhotos = new Map();
const stagedImages = new Map();
const bulkSaveBar = document.getElementById('bulk-save-bar');
const bulkSaveStatus = document.getElementById('bulk-save-status');
const tagFilter = document.getElementById('product-tag-filter');
const editableFields = ['name', 'desc', 'tags', 'price', 'q_available'];
function pendingProductChanges() {
  return productCards.flatMap(card => {
    const id = card.dataset.productId, before = savedProducts.get(id);
    if (!before) return [];
    const changes = {};
    editableFields.forEach(field => { const raw = card.querySelector(`[data-field="${field}"]`).value; const value = field === 'tags' ? JSON.parse(raw) : raw; if (JSON.stringify(value) !== JSON.stringify(before[field])) changes[field] = value; });
    const photos = selectedPhotos.get(id) || before.photos, files = stagedImages.get(id) || [];
    if (files.length || JSON.stringify(photos) !== JSON.stringify(before.photos)) changes.photos = photos;
    const published = card.querySelector('.visibility-checkbox').checked;
    if (published !== before.published) changes.published = published;
    return Object.keys(changes).length ? [{ id, before, changes, files }] : [];
  });
}
function updateBulkSaveBar() {
  const count = pendingProductChanges().length; bulkSaveBar.hidden = count === 0;
  document.getElementById('bulk-change-count').textContent = `${count} product${count === 1 ? '' : 's'} with unsaved changes`;
}
function releaseStagedImages(id) { (stagedImages.get(id) || []).forEach(image => URL.revokeObjectURL(image.url)); stagedImages.set(id, []); }
function renderEditImages(card, id, name) {
  const container = card.querySelector('.edit-images'); container.replaceChildren();
  const items = [...(selectedPhotos.get(id) || []).map((photo, index) => ({ photo, index })).filter(item => item.photo !== '/assets/images/flower.svg'), ...(stagedImages.get(id) || []).map((image, index) => ({ image, index }))];
  items.forEach(item => {
    const wrapper = document.createElement('div'); wrapper.className = 'edit-image-item';
    const image = document.createElement('img'); image.alt = `Image for ${name}`; image.src = item.image?.url || item.photo;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button-sm'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove image from ${name}`);
    remove.addEventListener('click', () => {
      removal = () => {
        if (item.image) { URL.revokeObjectURL(stagedImages.get(id)[item.index].url); stagedImages.get(id).splice(item.index, 1); }
        else selectedPhotos.get(id).splice(item.index, 1);
        card.querySelector('.form-error').textContent = '';
        renderEditImages(card, id, name); updateBulkSaveBar();
        card.querySelector('.add-product-images').focus();
      };
      removeDialog.showModal();
    });
    wrapper.append(image, remove); container.append(wrapper);
  });
}
showView();
function addEditImages(card, id, files) {
  const retained = (selectedPhotos.get(id) || []).filter(photo => photo !== '/assets/images/flower.svg').length;
  const staged = stagedImages.get(id);
  const errors = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) errors.push(`${file.name}: choose a JPG, PNG, or WebP image.`);
    else if (!file.size || file.size > 10 * 1024 * 1024) errors.push(`${file.name}: choose a nonempty image up to 10 MB.`);
    else if (retained + staged.length >= 10) errors.push('A product can have up to 10 images.');
    else if (!staged.some(image => image.file.name === file.name && image.file.size === file.size && image.file.lastModified === file.lastModified)) {
      staged.push({ file, url: URL.createObjectURL(file) });
    }
  }
  card.querySelector('.form-error').textContent = errors.join(' ');
  renderEditImages(card, id, card.querySelector('[data-field="name"]').value);
  updateBulkSaveBar();
}
function filterProducts() {
  const publication = document.querySelector('input[name="publication-filter"]:checked').value;
  let count = 0;
  productCards.forEach(card => {
    const published = savedProducts.get(card.dataset.productId)?.published === true;
    const matchesStatus = publication === 'all' || published === (publication === 'published');
    card.hidden = !matchesStatus || (tagFilter.value !== 'all' && !(JSON.parse(card.dataset.tags).length ? JSON.parse(card.dataset.tags) : ['']).some(tag => `tag:${tag}` === tagFilter.value));
    if (!card.hidden) count++;
  });
  document.getElementById('product-filter-count').textContent = `${count} of ${productCards.length} products`;
  const empty = document.getElementById('product-filter-empty');
  empty.textContent = productCards.length ? 'No products match these filters.' : 'No products yet.';
  empty.hidden = count !== 0;
}
tagFilter.addEventListener('change', filterProducts);
document.querySelectorAll('input[name="publication-filter"]').forEach(input => input.addEventListener('change', filterProducts));

document.getElementById('bulk-undo').addEventListener('click', () => {
  productCards.forEach(card => {
    const id = card.dataset.productId;
    const before = savedProducts.get(id);
    editableFields.forEach(field => { card.querySelector(`[data-field="${field}"]`).value = field === 'tags' ? JSON.stringify(before[field]) : before[field]; });
    card.querySelector('.visibility-checkbox').checked = before.published;
    selectedPhotos.set(id, [...before.photos]);
    releaseStagedImages(id);
    card.querySelector('.form-error').textContent = '';
    renderEditImages(card, id, before.name);
    updateCardDetails(card);
    card.querySelectorAll('[data-field]').forEach(input => input.setCustomValidity(''));
  });
  bulkSaveStatus.textContent = '';
  updateBulkSaveBar();
  document.getElementById('main').focus({ preventScroll: true });
});

let savingProducts = false;
document.getElementById('bulk-save').addEventListener('click', async () => {
  const edits = pendingProductChanges();
  if (!edits.length || savingProducts) return;
  const totalBytes = edits.flatMap(edit => edit.files).reduce((sum, image) => sum + image.file.size, 0);
  for (const edit of edits) {
    const card = productCards.find(item => item.dataset.productId === edit.id);
    const inputs = [...card.querySelectorAll('[data-field]')];
    inputs.forEach(input => {
      const field = input.dataset.field;
      input.setCustomValidity(['name', 'desc'].includes(field) && !input.value.trim() ? 'Enter a value containing more than spaces.' : '');
    });
    const photos = edit.changes.photos || edit.before.photos;
    const imageCount = photos.filter(photo => photo !== '/assets/images/flower.svg').length + edit.files.length;
    const invalid = inputs.find(input => !input.checkValidity());
    if (invalid || imageCount > 10 || totalBytes > 20 * 1024 * 1024) {
      if (imageCount > 10) card.querySelector('.form-error').textContent = 'A product can have up to 10 images.';
      if (totalBytes > 20 * 1024 * 1024) bulkSaveStatus.textContent = 'Uploaded images must total no more than 20 MB per save.';
      tagFilter.value = 'all';
      document.querySelector('input[name="publication-filter"][value="all"]').checked = true;
      filterProducts();
      card.classList.add('is-editing');
      card.querySelector('.inline-editor').hidden = false;
      card.querySelector('.product-edit').setAttribute('aria-expanded', 'true');
      card.querySelector('.product-edit').textContent = 'Done editing';
      if (invalid) invalid.reportValidity();
      else card.querySelector('.add-product-images').focus();
      return;
    }
  }
  const form = new FormData();
  form.append('edits', JSON.stringify(edits.map(({ before, changes }) => ({ before, changes }))));
  edits.forEach(({ id, files }) => files.forEach(({ file }) => form.append(`photos:${id}`, file)));
  const controls = [...document.getElementById('product-grid').querySelectorAll('input, textarea, button')];
  const disabled = controls.map(control => control.disabled);
  const saveButton = document.getElementById('bulk-save');
  savingProducts = true;
  controls.forEach(control => { control.disabled = true; });
  document.getElementById('bulk-undo').disabled = true;
  saveButton.textContent = 'Saving…';
  bulkSaveStatus.textContent = 'Saving product changes…';
  try {
    const response = await fetch('/api/products', { method: 'PATCH', headers: { 'X-Product-Request': 'edit' }, body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save product changes.');
    edits.forEach(edit => releaseStagedImages(edit.id));
    result.forEach(product => {
      savedProducts.set(product.id, product);
      selectedPhotos.set(product.id, [...product.photos]);
      const card = productCards.find(card => card.dataset.productId === product.id);
      editableFields.forEach(field => { card.querySelector(`[data-field="${field}"]`).value = field === 'tags' ? JSON.stringify(product[field]) : product[field]; });
      card.querySelector('.visibility-checkbox').checked = product.published;
      updateCardDetails(card);
    });
    await loadProducts();
    loadTags();
    document.getElementById('product-created-status').textContent = `${edits.length} product${edits.length === 1 ? '' : 's'} saved.`;
  } catch (error) {
    bulkSaveStatus.textContent = error.message || 'Could not save product changes. Your edits are still pending.';
  } finally {
    savingProducts = false;
    controls.forEach((control, index) => { control.disabled = disabled[index]; });
    document.getElementById('bulk-undo').disabled = false;
    saveButton.textContent = 'Save changes';
    updateBulkSaveBar();
  }
});

window.addEventListener('beforeunload', event => {
  if (!creatingProduct && !pendingProductChanges().length) return;
  event.preventDefault();
  event.returnValue = '';
});

async function loadProducts() {
  const pending = new Map(pendingProductChanges().map(edit => [edit.id, edit]));
  const grid = document.getElementById('product-grid');
  const status = document.getElementById('products-load-status');
  const retry = document.getElementById('products-retry');
  status.textContent = 'Loading products…';
  retry.hidden = true;
  grid.setAttribute('aria-busy', 'true');
  tagFilter.disabled = true;
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Could not load products');
    const products = await response.json();
    if (!Array.isArray(products)) throw new Error('Invalid products');
    const fragment = document.createDocumentFragment();
    products.forEach(serverProduct => {
      const pendingEdit = pending.get(serverProduct.id);
      const product = pendingEdit ? { ...serverProduct, ...pendingEdit.changes } : serverProduct;
      const card = document.getElementById('product-card-template').content.firstElementChild.cloneNode(true);
      const id = product.id;
      card.dataset.productId = id;
      card.dataset.tags = JSON.stringify(serverProduct.tags || []);
      card.querySelector('h2').textContent = product.name;
      renderTagLabels(card, product.tags || []);
      card.querySelector('.product-card-content > p').textContent = product.desc;
      editableFields.forEach(field => { card.querySelector(`[data-field="${field}"]`).value = field === 'tags' ? JSON.stringify(product.tags || []) : product[field] ?? ''; });
      const values = card.querySelectorAll('dd');
      const price = Number(product.price);
      values[0].textContent = Number.isFinite(price) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price) : product.price;
      values[1].textContent = product.q_available;
      const checkbox = card.querySelector('.visibility-checkbox');
      checkbox.checked = pendingEdit?.changes.published ?? product.published === true;
      checkbox.setAttribute('aria-label', `Publish ${product.name} on website`);
      checkbox.addEventListener('change', () => { bulkSaveStatus.textContent = ''; updateBulkSaveBar(); });
      card.querySelector('.product-delete').setAttribute('aria-label', `Delete ${product.name}`);
      const editButton = card.querySelector('.product-edit');
      editButton.setAttribute('aria-label', `Edit ${product.name}`);
      editButton.addEventListener('click', () => {
        const editing = card.classList.toggle('is-editing');
        card.querySelector('.inline-editor').hidden = !editing;
        editButton.textContent = editing ? 'Done editing' : 'Edit';
        editButton.setAttribute('aria-expanded', String(editing));
        if (editing) card.querySelector('[data-field="name"]').focus();
        else updateCardDetails(card);
      });
      card.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => {
        input.setCustomValidity('');
        card.querySelector('.form-error').textContent = '';
        bulkSaveStatus.textContent = '';
        updateBulkSaveBar();
      }));
      card.querySelector('.add-product-images').addEventListener('click', () => {
        imageCard = card;
        dialogFiles = [];
        renderDialogFiles();
        document.getElementById('edit-dialog-error').textContent = '';
        addDialog.showModal();
      });
      initTagEditor(card.querySelector('.tags-editor'));
      savedProducts.set(id, pendingEdit?.before || serverProduct);
      selectedPhotos.set(id, [...(pendingEdit?.changes.photos || serverProduct.photos)]);
      stagedImages.set(id, pendingEdit?.files || []);
      renderEditImages(card, id, product.name);
      const photo = serverProduct.photos?.[0];
      if (typeof photo === 'string' && photo !== '/assets/images/flower.svg') {
        try {
          const url = new URL(photo, location.origin);
          if (['http:', 'https:'].includes(url.protocol) && url.hostname !== 'example.com') {
            const image = document.createElement('img');
            image.className = 'product-photo';
            image.alt = serverProduct.name;
            image.loading = 'lazy';
            image.src = url.href;
            image.addEventListener('error', () => image.remove());
            card.querySelector('.product-image').append(image);
          }
        } catch { /* Keep the placeholder for invalid image URLs. */ }
      }
      fragment.append(card);
    });
    grid.replaceChildren(fragment);
    productCards = [...grid.querySelectorAll('.product-card')];
    tagFilter.replaceChildren(new Option('All tags', 'all'));
    [...new Set(productCards.flatMap(card => { const tags = JSON.parse(card.dataset.tags); return tags.length ? tags : ['']; }))].sort().forEach(tag => {
      tagFilter.add(new Option(tag || 'Uncategorized', `tag:${tag}`));
    });
    filterProducts();
    updateBulkSaveBar();
    status.textContent = '';
    tagFilter.disabled = false;
  } catch {
    status.textContent = 'Could not load products. Please try again.';
    retry.hidden = false;
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}
document.getElementById('products-retry').addEventListener('click', loadProducts);
loadProducts();

function updateCardDetails(card) {
  const value = field => card.querySelector(`[data-field="${field}"]`).value;
  card.querySelector('h2').textContent = value('name');
  renderTagLabels(card, JSON.parse(value('tags')));
  initTagEditor(card.querySelector('.tags-editor'));
  card.querySelector('.product-card-content > p').textContent = value('desc');
  const values = card.querySelectorAll('dd');
  values[0].textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value('price')));
  values[1].textContent = value('q_available');
}

const addDialog = document.getElementById('add-images-dialog');
const removeDialog = document.getElementById('remove-image-dialog');
let imageCard = null;
let dialogFiles = [];
let removal = null;
function renderDialogFiles() {
  const list = document.getElementById('edit-dialog-previews');
  list.replaceChildren();
  dialogFiles.forEach((entry, index) => {
    const item = document.createElement('li');
    const image = document.createElement('img'); image.src = entry.url; image.alt = entry.file.name;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => { URL.revokeObjectURL(entry.url); dialogFiles.splice(index, 1); renderDialogFiles(); });
    item.append(image, remove); list.append(item);
  });
  document.getElementById('confirm-add-images').disabled = !dialogFiles.length;
}
function selectDialogFiles(files) {
  const id = imageCard.dataset.productId;
  const retained = (selectedPhotos.get(id) || []).filter(photo => photo !== '/assets/images/flower.svg').length;
  const errors = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) errors.push(`${file.name}: choose an image no larger than 10 MB.`);
    else if (retained + stagedImages.get(id).length + dialogFiles.length >= 10) errors.push('A product can have up to 10 images.');
    else dialogFiles.push({ file, url: URL.createObjectURL(file) });
  }
  document.getElementById('edit-dialog-error').textContent = errors.join(' ');
  renderDialogFiles();
}
document.getElementById('edit-dialog-files').addEventListener('change', event => { selectDialogFiles(event.target.files); event.target.value = ''; });
const editDropzone = document.getElementById('edit-dropzone');
editDropzone.addEventListener('dragover', event => { event.preventDefault(); editDropzone.classList.add('is-dragging'); });
editDropzone.addEventListener('dragleave', () => editDropzone.classList.remove('is-dragging'));
editDropzone.addEventListener('drop', event => { event.preventDefault(); editDropzone.classList.remove('is-dragging'); selectDialogFiles(event.dataTransfer.files); });
document.getElementById('confirm-add-images').addEventListener('click', () => {
  addEditImages(imageCard, imageCard.dataset.productId, dialogFiles.map(entry => entry.file));
  addDialog.close();
});
document.getElementById('confirm-remove-image').addEventListener('click', () => { removeDialog.close(); removal?.(); removal = null; });
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
addDialog.addEventListener('close', () => {
  dialogFiles.forEach(entry => URL.revokeObjectURL(entry.url)); dialogFiles = [];
  editDropzone.classList.remove('is-dragging');
  document.getElementById('edit-dialog-files').value = '';
});

function renderTagLabels(card, tags) {
  const container = card.querySelector('.product-tags');
  container.replaceChildren(...(tags.length ? tags : ['Uncategorized']).map(tag => {
    const label = document.createElement('span'); label.className = 'product-tag caption-3'; label.textContent = tag; return label;
  }));
}
function initTagEditor(editor) {
  const value = editor.querySelector('.tags-value');
  const entry = editor.querySelector('.tag-entry');
  const chips = editor.querySelector('.tag-chips');
  const tags = JSON.parse(value.value || '[]');
  const commit = values => { value.value = JSON.stringify(values); value.dispatchEvent(new Event('input', { bubbles: true })); initTagEditor(editor); };
  chips.replaceChildren(...tags.map(tag => {
    const chip = document.createElement('span'); chip.className = 'tag-chip body-5';
    const label = document.createElement('span'); label.textContent = tag;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove tag ${tag}`);
    remove.onclick = () => { commit(tags.filter(item => item !== tag)); entry.focus(); };
    chip.append(label, remove); return chip;
  }));
  const add = () => { const tag = entry.value.trim(); if (tag) { entry.value = ''; commit([...new Set([...tags, tag])]); entry.focus(); } };
  editor.querySelector('.tag-add').onclick = add;
  entry.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); add(); } };
}
initTagEditor(productForm.querySelector('.tags-editor'));
