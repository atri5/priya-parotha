export const orderStatuses = ['ordered', 'in progress', 'complete'];

export class Order {
  constructor({ name = '', address = '', phone = '', price = '', priceIsCustom = false, due, products = {}, complete, status = complete === true ? 'complete' : 'ordered' } = {}) {
    if (typeof name !== 'string') throw new TypeError('name must be a string');
    if (typeof address !== 'string') throw new TypeError('address must be a string');
    if (typeof phone !== 'string') throw new TypeError('phone must be a string');
    if (typeof price !== 'string') throw new TypeError('price must be a string');
    if (typeof priceIsCustom !== 'boolean') throw new TypeError('priceIsCustom must be a boolean');
    if (complete !== undefined && typeof complete !== 'boolean') throw new TypeError('complete must be a boolean');
    if (!orderStatuses.includes(status)) throw new TypeError('Invalid order status');
    if (!(due instanceof Date) || !Number.isFinite(due.getTime())) {
      throw new TypeError('due must be a valid Date');
    }
    if (!products || typeof products !== 'object' ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(products))) {
      throw new TypeError('products must be a dictionary keyed by product ID');
    }
    for (const [id, amount] of Object.entries(products)) {
      if (!id.trim() || !Number.isSafeInteger(amount) || amount < 1) {
        throw new TypeError('products must have nonempty IDs and positive whole-number amounts');
      }
    }

    this.name = name;
    this.address = address;
    this.phone = phone;
    this.price = price;
    this.priceIsCustom = priceIsCustom;
    this.due = new Date(due.getTime());
    this.status = status;
    this.products = { ...products };
  }
}
