export const inputFields = ['name', 'price', 'q_available', 'desc', 'photos'];
export const requiredFields = ['id', ...inputFields];
export const stringFields = ['id', 'name', 'price', 'q_available', 'desc'];

export function productData() {
  return {
    name: 'Aloo Parotha',
    price: '5.00',
    q_available: '20',
    desc: 'Potato-stuffed flatbread.',
    photos: ['https://example.com/aloo-parotha.jpg'],
  };
}

export function completeProductData() {
  return { id: 'product-1', ...productData() };
}

export function withoutField(data, field) {
  const copy = { ...data };
  delete copy[field];
  return copy;
}

export function isFieldError(field) {
  return (error) => error instanceof Error
    && error.message.includes(field);
}
