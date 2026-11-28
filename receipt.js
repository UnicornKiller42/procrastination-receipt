(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.Receipt = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var WIDTH = 32;
  var SHOP_NAME = 'AVOIDANCE MART';
  var FOOTER = [
    'Thank you for not doing it.',
    'Please come again tomorrow.',
  ];
  var KEY = [
    'GU means guilt units',
    'min is a made-up time cost',
    'not how long the task takes',
    'regret tax is a made-up extra',
  ];
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function hashText(text) {
    var hash = 5381;
    var value = String(text).trim().toLowerCase();
    for (var i = 0; i < value.length; i += 1) {
      hash = (((hash << 5) + hash) + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function normalizeTask(task) {
    return String(task == null ? '' : task).trim().replace(/\s+/g, ' ');
  }

  function parseTasks(input) {
    var lines = Array.isArray(input)
      ? input
      : String(input == null ? '' : input).split(/\r?\n/);
    return lines.map(normalizeTask).filter(function (line) {
      return line.length > 0;
    });
  }

  function priceTask(task) {
    var name = normalizeTask(task);
    var hash = hashText(name);
    return {
      name: name,
      amount: (hash % 42) + 8,
      unit: hash % 5 === 0 ? 'GU' : 'min',
    };
  }

  function formatAmount(amount, unit) {
    return unit === 'GU' ? amount + ' GU' : amount + ' min';
  }

  function describeAmount(amount, unit) {
    var n = Number(amount);
    if (unit === 'GU') {
      return n === 1 ? '1 guilt unit' : n + ' guilt units';
    }
    return n === 1 ? '1 minute' : n + ' minutes';
  }

  function regretRate(items) {
    if (!items.length) {
      return 0;
    }
    var hash = hashText(items.map(function (item) {
      return item.name;
    }).join('\n'));
    return 8 + (hash % 9);
  }

  function taxed(amount, rate) {
    if (amount <= 0 || rate <= 0) {
      return 0;
    }
    return Math.max(1, Math.round((amount * rate) / 100));
  }

  function barcodeDigits(items) {
    var source = items.map(function (item) {
      return item.name.toLowerCase() + ':' + item.amount + item.unit;
    }).join('|');
    var hash = hashText(source);
    var digits = '';
    var n = hash;
    for (var i = 0; i < 13; i += 1) {
      digits += String(n % 10);
      n = (Math.floor(hash / (i + 3)) + (n * 7) + i) >>> 0;
    }
    return digits;
  }

  function asDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    return new Date();
  }

  function formatStamp(date) {
    var dd = String(date.getDate()).padStart(2, '0');
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    return {
      dateLabel: DAYS[date.getDay()] + ' ' + dd + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear(),
      timeLabel: hh + ':' + mm,
    };
  }

  function buildReceipt(input, options) {
    var settings = options || {};
    var items = parseTasks(input).map(priceTask);
    var subtotal = { min: 0, GU: 0 };
    items.forEach(function (item) {
      subtotal[item.unit] += item.amount;
    });
    var rate = regretRate(items);
    var tax = {
      label: 'REGRET TAX ' + rate + '%',
      rate: rate,
      min: taxed(subtotal.min, rate),
      GU: taxed(subtotal.GU, rate),
    };
    var stamp = formatStamp(asDate(settings.now));
    return {
      shopName: SHOP_NAME,
      dateLabel: stamp.dateLabel,
      timeLabel: stamp.timeLabel,
      items: items,
      subtotal: subtotal,
      tax: tax,
      total: {
        min: subtotal.min + tax.min,
        GU: subtotal.GU + tax.GU,
      },
      barcode: barcodeDigits(items),
      key: KEY.slice(),
      footer: FOOTER.slice(),
    };
  }

  function pad(left, right) {
    var gap = WIDTH - left.length - right.length;
    if (gap < 1) {
      return left + ' ' + right;
    }
    return left + ' '.repeat(gap) + right;
  }

  function center(text) {
    if (text.length >= WIDTH) {
      return text;
    }
    var left = Math.floor((WIDTH - text.length) / 2);
    return ' '.repeat(left) + text + ' '.repeat(WIDTH - text.length - left);
  }

  function rowsFor(label, bucket) {
    var parts = [];
    if (bucket.min) {
      parts.push(['min', bucket.min]);
    }
    if (bucket.GU) {
      parts.push(['GU', bucket.GU]);
    }
    if (!parts.length) {
      parts.push(['min', 0]);
    }
    return parts.map(function (part, index) {
      return pad(index === 0 ? label : '', formatAmount(part[1], part[0]));
    });
  }

  function formatReceipt(receipt) {
    var lines = [
      center(receipt.shopName),
      pad(receipt.dateLabel, receipt.timeLabel),
      '',
    ];
    receipt.items.forEach(function (item) {
      var amount = formatAmount(item.amount, item.unit);
      if (item.name.length + 1 + amount.length <= WIDTH) {
        lines.push(pad(item.name, amount));
      } else {
        lines.push(item.name);
        lines.push(pad('', amount));
      }
    });
    lines.push('-'.repeat(WIDTH));
    rowsFor('SUBTOTAL', receipt.subtotal).forEach(function (line) {
      lines.push(line);
    });
    rowsFor(receipt.tax.label, { min: receipt.tax.min, GU: receipt.tax.GU }).forEach(function (line) {
      lines.push(line);
    });
    lines.push('-'.repeat(WIDTH));
    rowsFor('TOTAL', receipt.total).forEach(function (line) {
      lines.push(line);
    });
    lines.push('');
    lines.push(center(receipt.barcode));
    lines.push('');
    receipt.key.forEach(function (line) {
      lines.push(center(line));
    });
    lines.push('');
    receipt.footer.forEach(function (line) {
      lines.push(center(line));
    });
    return lines.join('\n');
  }

  return {
    parseTasks: parseTasks,
    priceTask: priceTask,
    buildReceipt: buildReceipt,
    formatReceipt: formatReceipt,
    formatAmount: formatAmount,
    describeAmount: describeAmount,
  };
});
