export const productFields = ['id', 'name', 'price', 'q_available', 'desc', 'photos'];

export class Product {
  constructor(data) {
    for (const field of productFields) {
      const value = data?.[field];
      const valid = field === 'photos'
        ? Array.isArray(value) && value.length > 0
        : typeof value === 'string' && value.trim().length > 0;
      if (!valid) throw new TypeError(`${field} must be a nonempty ${field === 'photos' ? 'array' : 'string'}`);
      this[field] = value;
    }
  }
}
