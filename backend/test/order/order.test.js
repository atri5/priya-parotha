import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Order } from '../../src/order/order.js';

test('Order stores a due date and amounts keyed by product ID', () => {
  const due = new Date('2026-12-01');
  const products = { 'product-1': 2 };
  const order = new Order({ name: 'Lunch order', address: '12 Oak St', phone: '+1 555 0100', price: '11.00', priceIsCustom: true, due, products, status: 'in progress' });

  assert.equal(order.status, 'in progress');
  assert.equal(new Order({ due, complete: true }).status, 'complete');
  assert.throws(() => new Order({ due, status: 'pending' }), /status/);
  assert.throws(() => new Order({ due, complete: 'false' }), /boolean/);
  assert.equal(order.name, 'Lunch order');
  assert.equal(order.address, '12 Oak St');
  assert.equal(order.phone, '+1 555 0100');
  assert.equal(order.priceIsCustom, true);
  assert.equal(order.price, '11.00');
  assert.deepEqual(order.due, due);
  assert.deepEqual(order.products, products);
  products['product-1'] = 3;
  assert.equal(order.products['product-1'], 2);
  assert.deepEqual({ ...new Order({ due }) }, { name: '', address: '', phone: '', price: '', priceIsCustom: false, due, products: {}, status: 'ordered' });
  assert.throws(() => new Order({ due: new Date('invalid') }), /valid Date/);
  assert.throws(() => new Order({ due, products: { 'product-1': 0 } }), /positive whole-number/);
});
