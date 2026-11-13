export const productFields = ['id', 'name', 'price', 'q_available', 'desc', 'photos', 'tags', 'published'];

export class Product {
  constructor(data) {
    for (const field of productFields) {
      const value = field === 'tags' && data?.tags === undefined ? [] : data?.[field];
      if (field === 'published') {
        this.published = value === undefined ? false : value;
        if (typeof this.published !== 'boolean') throw new TypeError('published must be a boolean');
        continue;
      }
      if (field === 'tags') {
        if (!Array.isArray(value) || value.some(tag => typeof tag !== 'string' || !tag.trim())) throw new TypeError('tags must be an array of nonempty strings');
        this.tags = [...new Set(value)];
        continue;
      }
      const valid = field === 'photos'
        ? Array.isArray(value) && value.length > 0
        : typeof value === 'string' && value.trim().length > 0;
      if (!valid) throw new TypeError(`${field} must be a nonempty ${field === 'photos' ? 'array' : 'string'}`);
      this[field] = value;
    }
  }
}
