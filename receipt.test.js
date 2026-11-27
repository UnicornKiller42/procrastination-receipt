'use strict';

const assert = require('assert');
const {
  parseTasks,
  priceTask,
  buildReceipt,
  formatReceipt,
  formatAmount,
  describeAmount,
} = require('./receipt.js');

const when = new Date(2026, 10, 27, 5, 4, 30);

function test(name, fn) {
  test.cases.push({ name, fn });
}
test.cases = [];

test('parseTasks keeps one trimmed task per line', () => {
  assert.deepStrictEqual(
    parseTasks('answer emails\n\n  do   laundry  \n'),
    ['answer emails', 'do laundry']
  );
});

test('parseTasks accepts Windows line endings', () => {
  assert.deepStrictEqual(
    parseTasks('answer emails\r\ndo laundry\r\n'),
    ['answer emails', 'do laundry']
  );
});

test('parseTasks accepts a list and drops blanks', () => {
  assert.deepStrictEqual(
    parseTasks([' answer emails ', '', '   ', 'do laundry']),
    ['answer emails', 'do laundry']
  );
});

test('parseTasks on empty input is an empty list', () => {
  assert.deepStrictEqual(parseTasks(''), []);
  assert.deepStrictEqual(parseTasks('   \n \t '), []);
  assert.deepStrictEqual(parseTasks(null), []);
});

test('priceTask prices answer emails at 10 minutes', () => {
  assert.deepStrictEqual(priceTask('answer emails'), {
    name: 'answer emails',
    amount: 10,
    unit: 'min',
  });
});

test('priceTask prices do laundry at 13 minutes', () => {
  assert.deepStrictEqual(priceTask('  do   laundry '), {
    name: 'do laundry',
    amount: 13,
    unit: 'min',
  });
});

test('priceTask prices a single letter in guilt units', () => {
  assert.deepStrictEqual(priceTask('a'), {
    name: 'a',
    amount: 18,
    unit: 'GU',
  });
});

test('priceTask prices file taxes at 24 guilt units', () => {
  assert.deepStrictEqual(priceTask('file taxes'), {
    name: 'file taxes',
    amount: 24,
    unit: 'GU',
  });
});

test('priceTask ignores letter case', () => {
  assert.deepStrictEqual(priceTask('Answer Emails').amount, 10);
  assert.strictEqual(priceTask('Answer Emails').unit, 'min');
  assert.strictEqual(priceTask('Answer Emails').name, 'Answer Emails');
  assert.deepStrictEqual(priceTask('Do Laundry').amount, priceTask('do laundry').amount);
});

test('priceTask is stable and stays in the playful range', () => {
  const samples = ['call mom', 'water plants', 'reply to Sam', 'a', 'file taxes'];
  for (const sample of samples) {
    const first = priceTask(sample);
    const second = priceTask(sample);
    assert.deepStrictEqual(second, first);
    assert.ok(Number.isInteger(first.amount));
    assert.ok(first.amount >= 8 && first.amount <= 49);
    assert.ok(first.unit === 'min' || first.unit === 'GU');
  }
  assert.deepStrictEqual(priceTask('call mom'), {
    name: 'call mom',
    amount: 16,
    unit: 'min',
  });
});

test('formatAmount and describeAmount spell the two currencies', () => {
  assert.strictEqual(formatAmount(10, 'min'), '10 min');
  assert.strictEqual(formatAmount(18, 'GU'), '18 GU');
  assert.strictEqual(describeAmount(1, 'min'), '1 minute');
  assert.strictEqual(describeAmount(10, 'min'), '10 minutes');
  assert.strictEqual(describeAmount(1, 'GU'), '1 guilt unit');
  assert.strictEqual(describeAmount(18, 'GU'), '18 guilt units');
});

test('buildReceipt totals minutes with a regret tax', () => {
  const receipt = buildReceipt('answer emails\ndo laundry', { now: when });
  assert.strictEqual(receipt.shopName, 'AVOIDANCE MART');
  assert.strictEqual(receipt.dateLabel, 'FRI 27 NOV 2026');
  assert.strictEqual(receipt.timeLabel, '05:04');
  assert.strictEqual(receipt.items.length, 2);
  assert.deepStrictEqual(receipt.subtotal, { min: 23, GU: 0 });
  assert.strictEqual(receipt.tax.label, 'REGRET TAX 13%');
  assert.strictEqual(receipt.tax.rate, 13);
  assert.strictEqual(receipt.tax.min, 3);
  assert.strictEqual(receipt.tax.GU, 0);
  assert.deepStrictEqual(receipt.total, { min: 26, GU: 0 });
  assert.strictEqual(receipt.barcode, '1800833200450');
  assert.deepStrictEqual(receipt.footer, [
    'Thank you for not doing it.',
    'Please come again tomorrow.',
  ]);
});

test('buildReceipt keeps guilt units beside minutes', () => {
  const receipt = buildReceipt(['answer emails', 'a'], { now: when });
  assert.deepStrictEqual(receipt.subtotal, { min: 10, GU: 18 });
  assert.strictEqual(receipt.tax.rate, 13);
  assert.strictEqual(receipt.tax.min, 1);
  assert.strictEqual(receipt.tax.GU, 2);
  assert.deepStrictEqual(receipt.total, { min: 11, GU: 20 });
});

test('buildReceipt prices guilt-only tasks', () => {
  const receipt = buildReceipt('file taxes', { now: when });
  assert.deepStrictEqual(receipt.subtotal, { min: 0, GU: 24 });
  assert.strictEqual(receipt.tax.rate, 15);
  assert.strictEqual(receipt.tax.min, 0);
  assert.strictEqual(receipt.tax.GU, 4);
  assert.deepStrictEqual(receipt.total, { min: 0, GU: 28 });
});

test('repeated tasks are separate line items', () => {
  const receipt = buildReceipt('answer emails\nanswer emails', { now: when });
  assert.strictEqual(receipt.items.length, 2);
  assert.deepStrictEqual(receipt.subtotal, { min: 20, GU: 0 });
  assert.strictEqual(receipt.tax.rate, 9);
  assert.strictEqual(receipt.tax.min, 2);
  assert.deepStrictEqual(receipt.total, { min: 22, GU: 0 });
});

test('letter case does not change the till numbers or barcode', () => {
  const lower = buildReceipt('answer emails\ndo laundry', { now: when });
  const mixed = buildReceipt('Answer Emails\nDo Laundry', { now: when });
  assert.strictEqual(mixed.subtotal.min, lower.subtotal.min);
  assert.strictEqual(mixed.tax.rate, lower.tax.rate);
  assert.strictEqual(mixed.total.min, lower.total.min);
  assert.strictEqual(mixed.barcode, lower.barcode);
  assert.strictEqual(mixed.items[0].name, 'Answer Emails');
});

test('the same list always prints the same receipt', () => {
  const first = buildReceipt('do laundry\nfile taxes', { now: when });
  const second = buildReceipt('do laundry\nfile taxes', { now: when });
  assert.deepStrictEqual(second, first);
});

test('empty input still builds a receipt and does not throw', () => {
  const receipt = buildReceipt('  \n\t', { now: when });
  assert.deepStrictEqual(receipt.items, []);
  assert.deepStrictEqual(receipt.subtotal, { min: 0, GU: 0 });
  assert.strictEqual(receipt.tax.rate, 0);
  assert.deepStrictEqual(receipt.total, { min: 0, GU: 0 });
  assert.ok(formatReceipt(receipt).includes('Thank you for not doing it.'));
  assert.ok(!/error/i.test(formatReceipt(receipt)));
});

test('formatReceipt lays out a narrow till slip', () => {
  const receipt = buildReceipt('answer emails\ndo laundry', { now: when });
  const text = formatReceipt(receipt);
  const expected = [
    '         AVOIDANCE MART         ',
    'FRI 27 NOV 2026            05:04',
    '',
    'answer emails             10 min',
    'do laundry                13 min',
    '--------------------------------',
    'SUBTOTAL                  23 min',
    'REGRET TAX 13%             3 min',
    '--------------------------------',
    'TOTAL                     26 min',
    '',
    '         1800833200450          ',
    '',
    '  Thank you for not doing it.   ',
    '  Please come again tomorrow.   ',
  ].join('\n');
  assert.strictEqual(text, expected);
  for (const line of text.split('\n')) {
    if (line.length !== 0) {
      assert.strictEqual(line.length, 32);
    }
  }
});

test('formatReceipt puts a long task above its price', () => {
  const name = 'reorganize the entire bookshelf tonight please';
  const item = priceTask(name);
  const text = formatReceipt(buildReceipt(name, { now: when }));
  const lines = text.split('\n');
  const amount = formatAmount(item.amount, item.unit);
  assert.ok(item.name.length + 1 + amount.length > 32);
  assert.ok(lines.includes(item.name));
  assert.ok(lines.includes(amount.padStart(32, ' ')));
});

let failed = 0;
for (const { name, fn } of test.cases) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (error) {
    failed += 1;
    console.error('not ok - ' + name);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(failed + ' failed');
  process.exit(1);
}

console.log(test.cases.length + ' passed');
