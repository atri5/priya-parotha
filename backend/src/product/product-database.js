// Storage implementations return Products and throw when a requested ID is absent.
// update must validate and persist merged fields together; failed updates change nothing.
export class ProductDatabase {
  list() { throw new Error('list not implemented'); }
  get(id) { throw new Error('get not implemented'); }
  create(product) { throw new Error('create not implemented'); }
  update(id, changes) { throw new Error('update not implemented'); }
  delete(id) { throw new Error('delete not implemented'); }
}
