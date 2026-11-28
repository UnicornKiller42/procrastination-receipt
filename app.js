(function () {
  var form = document.getElementById('avoid-form');
  var taskInput = document.getElementById('task-input');
  var addButton = document.getElementById('add-item');
  var tasks = document.getElementById('tasks');
  var hint = document.getElementById('hint');
  var slip = document.getElementById('slip');
  var receiptEl = document.getElementById('receipt');
  var printButton = document.getElementById('print-paper');

  function showHint(show) {
    hint.hidden = !show;
    if (show) {
      tasks.setAttribute('aria-describedby', 'hint');
    } else {
      tasks.removeAttribute('aria-describedby');
    }
  }

  function appendTask(name) {
    var current = tasks.value.replace(/\s+$/, '');
    tasks.value = current ? current + '\n' + name : name;
  }

  function addItem() {
    var name = String(taskInput.value || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      taskInput.focus();
      return;
    }
    appendTask(name);
    taskInput.value = '';
    showHint(false);
    taskInput.focus();
  }

  function row(className, label, amount, unit) {
    var line = document.createElement('p');
    line.className = className;
    var left = document.createElement('span');
    left.textContent = label;
    var right = document.createElement('span');
    right.textContent = Receipt.formatAmount(amount, unit);
    right.setAttribute('aria-label', Receipt.describeAmount(amount, unit));
    line.appendChild(left);
    line.appendChild(right);
    return line;
  }

  function moneyRows(parent, className, label, bucket) {
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
    for (var i = 0; i < parts.length; i += 1) {
      parent.appendChild(row(className, i === 0 ? label : '', parts[i][1], parts[i][0]));
    }
  }

  function barcode(digits) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'barcode');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    var x = 0;
    var height = 46;
    for (var i = 0; i < digits.length; i += 1) {
      var n = Number(digits.charAt(i));
      var width = n % 3 === 0 ? 3 : (n % 2 === 0 ? 2 : 1);
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
      svg.appendChild(rect);
      x += width + (n % 2 === 0 ? 2 : 1);
    }
    svg.setAttribute('viewBox', '0 0 ' + x + ' ' + height);
    return svg;
  }

  function render(receipt) {
    receiptEl.replaceChildren();

    var shop = document.createElement('p');
    shop.className = 'shop';
    shop.textContent = receipt.shopName;
    receiptEl.appendChild(shop);

    var when = document.createElement('p');
    when.className = 'when';
    var date = document.createElement('span');
    date.textContent = receipt.dateLabel;
    var time = document.createElement('span');
    time.textContent = receipt.timeLabel;
    when.appendChild(date);
    when.appendChild(time);
    receiptEl.appendChild(when);

    var list = document.createElement('ul');
    list.className = 'items';
    receipt.items.forEach(function (item) {
      var entry = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = item.name;
      var price = document.createElement('span');
      price.className = 'price';
      price.textContent = Receipt.formatAmount(item.amount, item.unit);
      price.setAttribute('aria-label', Receipt.describeAmount(item.amount, item.unit));
      entry.appendChild(name);
      entry.appendChild(price);
      list.appendChild(entry);
    });
    receiptEl.appendChild(list);

    var totals = document.createElement('div');
    totals.className = 'totals';
    moneyRows(totals, 'total-row', 'SUBTOTAL', receipt.subtotal);
    moneyRows(totals, 'total-row', receipt.tax.label, {
      min: receipt.tax.min,
      GU: receipt.tax.GU,
    });
    receiptEl.appendChild(totals);

    var grand = document.createElement('div');
    grand.className = 'grand';
    moneyRows(grand, 'total-row grand-row', 'TOTAL', receipt.total);
    receiptEl.appendChild(grand);

    receiptEl.appendChild(barcode(receipt.barcode));

    var digits = document.createElement('p');
    digits.className = 'barcode-digits';
    digits.textContent = receipt.barcode;
    receiptEl.appendChild(digits);

    var key = document.createElement('div');
    key.className = 'key';
    receipt.key.forEach(function (line) {
      var note = document.createElement('p');
      note.textContent = line;
      key.appendChild(note);
    });
    receiptEl.appendChild(key);

    receipt.footer.forEach(function (line) {
      var footer = document.createElement('p');
      footer.className = 'footer';
      footer.textContent = line;
      receiptEl.appendChild(footer);
    });
  }

  function play() {
    receiptEl.classList.remove('is-printing');
    void receiptEl.offsetWidth;
    receiptEl.classList.add('is-printing');
  }

  addButton.addEventListener('click', addItem);

  taskInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItem();
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var pending = String(taskInput.value || '').trim().replace(/\s+/g, ' ');
    if (pending) {
      appendTask(pending);
      taskInput.value = '';
    }
    var list = Receipt.parseTasks(tasks.value);
    if (!list.length) {
      showHint(true);
      slip.hidden = true;
      tasks.focus();
      return;
    }
    showHint(false);
    render(Receipt.buildReceipt(list, { now: new Date() }));
    slip.hidden = false;
    slip.scrollIntoView({ block: 'nearest' });
    play();
    printButton.focus({ preventScroll: true });
  });

  printButton.addEventListener('click', function () {
    window.print();
  });
})();
