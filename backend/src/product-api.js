// A fresh API instance gives each test independent product state.
// Storage and HTTP transport will be chosen when implementation begins.
export function createProductApi() {
  return {
    async createProduct(data) {
      throw new Error('createProduct is not implemented yet');
    },
    async editProduct(id, data) {
      throw new Error('editProduct is not implemented yet');
    },
    async deleteProduct(id) {
      throw new Error('deleteProduct is not implemented yet');
    },
  };
}
