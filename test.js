var tape = require('tape')
var DWRES = require('./')

tape('DWRES Tests: dWeb File Simple Read', function (t) {
  t.plan(2 * 4 + 4)

  var expected = [Buffer.from('hi'), Buffer.from('ho')]
  var queued = expected.slice(0)
  var s = DWRES({
    read: function (req) {
      process.nextTick(function () {
        t.same(req.offset, 0)
        t.same(req.size, 2)
        req.callback(null, queued.shift())
      })
    }
  })

  t.ok(s.readable)
  t.notOk(s.writable)
  t.notOk(s.removable)
  t.notOk(s.statable)
  s.read(0, 2, ondata)
  s.read(0, 2, ondata)

  function ondata (err, data) {
    t.error(err, 'DWRES Test Success! No Errors.')
    t.same(data, expected.shift())
  }
})

tape('DWRES Tests: dWeb File Simple Write', function (t) {
  t.plan(2 * 2 + 4)

  var expected = [Buffer.from('hi'), Buffer.from('ho')]
  var s = DWRES({
    write: function (req) {
      t.same(req.data, expected.shift())
      req.callback(null)
    }
  })

  t.notOk(s.readable)
  t.ok(s.writable)
  t.notOk(s.removable)
  t.notOk(s.statable)
  s.write(0, Buffer.from('hi'), onWrite)
  s.write(0, Buffer.from('ho'), onWrite)

  function onWrite (err, write) {
    t.error(err, 'DWRES Test Success! No Errors.')
  }
})

tape('DWRES Tests: dWeb File Simple Delete', function (t) {
  t.plan(2 + 2 * 3 + 4)

  var s = DWRES({
    remove: function (req) {
      t.same(req.offset, 0)
      t.same(req.size, 2)
      req.callback(null)
    }
  })

  t.notOk(s.readable)
  t.notOk(s.writable)
  t.ok(s.removable)
  t.notOk(s.statable)
  s.remove(0, 2, onremove)
  s.remove(0, 2, onremove)
  s.remove(0, 2) // cb is optional

  function onremove (err) {
    t.error(err, 'DWRES Test Success! No Errors.')
  }
})

tape('DWRES Tests: dWeb File Basic Stat', function (t) {
  t.plan(2 * 2 + 4)

  var s = DWRES({
    stat: function (req) {
      req.callback(null, {size: 42})
    }
  })

  t.notOk(s.readable)
  t.notOk(s.writable)
  t.notOk(s.removable)
  t.ok(s.statable)
  s.stat(onstat)
  s.stat(onstat)

  function onstat (err, st) {
    t.error(err, 'DWRES Test Success! No Errors.')
    t.same(st, {size: 42})
  }
})

tape('DWRES Tests: dWeb File With No Options (opts)', function (t) {
  var s = DWRES()

  t.notOk(s.readable)
  t.notOk(s.writable)
  t.notOk(s.removable)
  t.notOk(s.statable)
  t.end()
})

tape('DWRES Tests: dWeb File Only Opens Once With Many Open Calls', function (t) {
  t.plan(1)

  var s = DWRES({
    open: function (req) {
      process.nextTick(function () {
        t.pass('DWRES Test Success! File Is Opening.')
        req.callback(null)
      })
    }
  })

  s.open()
  s.open()
  s.open()
  s.open()
  s.open()
  setImmediate(() => s.open())
})

tape('DWRES Tests: dWeb File Open Errors', function (t) {
  t.plan(3 + 2)

  var s = DWRES({
    open: function (req) {
      t.pass('DWRES Test Success! File Opened.')
      setImmediate(() => req.callback(new Error('nope')))
    },
    write: function (req) {
      t.fail('DWRES Test Failed! Should Not Get Here!')
      req.callback(null)
    }
  })

  s.write(0, Buffer.from('hi'), onWrite)
  s.write(0, Buffer.from('hi'), onWrite)
  s.write(0, Buffer.from('hi'), onWrite)
  s.open() // should try and open again

  function onWrite (err) {
    t.same(err, new Error('DWRES Test Failed! File Did Not Open!'))
  }
})

tape('DWRES Tests: dWeb File Open Before Read', function (t) {
  t.plan(5 * 2 + 1 + 1)

  var open = false
  var s = DWRES({
    open: function (req) {
      t.ok(!open, 'DWRES Test Success! File Only Opened Once.')
      open = true
      req.callback(null)
    },
    read: function (req) {
      t.ok(open, 'DWRES Test Success! File Is Open.')
      req.callback(null, Buffer.from('hi'))
    }
  })

  t.notOk(s.opened, 'DWRES Tests: dWeb File Opened But Property Not Set')
  s.read(0, 2, ondata)
  s.read(0, 2, ondata)

  function ondata (err, data) {
    t.error(err, 'DWRES Test Failed!')
    t.ok(open, 'DWRES Test Success! File Opened.')
    t.ok(s.opened, 'DWRES Test Success! File Opened and Property Not Set.')
    t.same(data, Buffer.from('hi'))
  }
})

tape('DWRES Tests: dWeb File Close', function (t) {
  t.plan(6)

  var s = DWRES({
    close: function (req) {
      t.pass('DWRES Test Success! File Closing.')
      req.callback(null)
    }
  })

  s.on('closed', () => t.pass('DWRES Test Success! Close Command Sent.'))
  s.open()
  s.close()
  s.close()
  s.close(function () {
    t.pass('DWRES Test Success! File Called Callback.')
  })

  s.read(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.stat(err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.write(0, Buffer.from('hi'), err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.remove(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
})

tape('DWRES Tests: dWeb File Close Only If Open', function (t) {
  t.plan(5)

  var s = DWRES({
    close: req => t.fail('DWRES Test Failed! Only Close When Open!')
  })

  s.close()
  s.close()
  s.close(function () {
    t.pass('DWRES Test Success! File Called Callback.')
  })

  s.read(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.stat(err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.write(0, Buffer.from('hi'), err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.remove(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
})

tape('DWRES Tests: dWeb File Kill', function (t) {
  t.plan(3)

  var s = DWRES({
    open: req => t.fail('DWRES Test Failed! File Did Not Open!'),
    destroy: function (req) {
      t.pass('DWRES Test Success! File Killed.')
      req.callback(null)
    }
  })

  s.on('Kill', () => t.pass('destroy emitted'))
  s.destroy()
  s.destroy(function (err) {
    t.error(err, 'DWRES Test Success! No Errors.')
    t.pass('DWRES Test Success! File Callback Called.')
  })
})

tape('DWRES Tests: dWeb File Kill But Closes First', function (t) {
  t.plan(2)

  var s = DWRES({
    close: function (req) {
      t.pass('DWRES Test Success! File Closing.')
      req.callback(null)
    },
    destroy: function (req) {
      t.ok(s.closed, 'DWRES Test Success! File Is Closing')
      req.callback(null)
    }
  })

  s.open()
  s.destroy()
})

tape('DWRES Tests: dWeb File Kill With Explicit Close First', function (t) {
  t.plan(2)

  var s = DWRES({
    close: function (req) {
      t.pass('DWRES Test Success! File Closing.')
      req.callback(null)
    },
    destroy: function (req) {
      t.ok(s.closed, 'DWRES Test Success! File Is Closing')
      req.callback(null)
    }
  })

  s.open()
  s.close()
  s.destroy()
})

tape('DWRES Tests: dWeb File Open and Close', function (t) {
  t.plan(7)

  var s = DWRES({
    open: function (req) {
      t.pass('DWRES Test Success! File Opening.')
      req.callback(null)
    },
    close: function (req) {
      t.pass('DWRES Test Success! File Closing.')
      req.callback(null)
    }
  })

  s.open()
  s.close()
  s.close()
  s.close(function () {
    t.pass('DWRES Test Success! File Callback Called.')
  })

  s.read(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.stat(err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.write(0, Buffer.from('hi'), err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.remove(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
})

tape('DWRES Tests: dWeb File Write and Close.', function (t) {
  t.plan(1 + 5 + 1 + 3)

  var dPClosed = false
  var s = DWRES({
    open: function (req) {
      t.pass('DWRES Test Success! File Opened.')
      req.callback(null)
    },
    write: function (req) {
      t.pass('DWRES Test Success! File Was Written To.')
      process.nextTick(function () {
        req.callback(null)
      })
    },
    close: function (req) {
      t.notOk(dPClosed, 'DWRES Test Failed! File Did Not Close!')
      dPClosed = true
      req.callback(null)
    }
  })

  s.write(0, Buffer.from('hi'))
  s.write(0, Buffer.from('hi'))
  s.write(0, Buffer.from('hi'))
  s.write(0, Buffer.from('hi'))
  s.write(0, Buffer.from('hi'))
  s.close(err => t.error(err, 'DWRES Test Success! No Errors.'))
  s.close(err => t.error(err, 'DWRES Test Success! No Errors.'))
  s.close(err => t.error(err, 'DWRES Test Success! No Errors.'))
})

tape('DWRES Tests: dWeb File Open Read Only', function (t) {
  t.plan(2)

  var s = DWRES({
    open: () => t.fail('DWRES Test Failed: Did Not Open!'),
    openReadonly: function (req) {
      t.pass('DWRES Test Success! File Opened.')
      req.callback(null)
    },
    read: req => req.callback(null, Buffer.from('hi'))
  })

  s.open()
  s.read(0, 10, err => t.error(err, 'DWRES Test Success! No Errors.'))
})

tape('DWRES Tests: dWeb File Open Read Only Then Write', function (t) {
  t.plan(4)

  var readonlyFirst = true

  var s = DWRES({
    open: function (req) {
      t.notOk(readonlyFirst, 'DWRES Test Failed. Open Read Only First')
      req.callback(null)
    },
    openReadonly: function (req) {
      t.ok(readonlyFirst, 'DWRES Test Failed. Open Read Only First')
      readonlyFirst = false
      req.callback(null)
    },
    read: req => req.callback(null, Buffer.from('hi')),
    write: req => req.callback(null)
  })

  s.open()
  s.read(0, 2, err => t.error(err, 'DWRES Test Success! No Errors.'))
  s.write(0, Buffer.from('hi'), err => t.error(err, 'DWRES Test Success! No Errors.'))
})

tape('DWRES Tests: dWeb File Open ReadOnly Is Ignored When First Option Is Write', function (t) {
  t.plan(3)

  var s = DWRES({
    open: function (req) {
      t.pass('DWRES Test Success! dWeb File Should Open')
      req.callback(null)
    },
    openReadonly: req => t.fail('DWREST Test Failed: First Option Is A Write.'),
    read: req => req.callback(null, Buffer.from('hi')),
    write: req => req.callback(null)
  })

  s.write(0, Buffer.from('hi'), err => t.error(err, 'DWRES Test Success! No Errors.'))
  s.read(0, 2, err => t.error(err, 'DWRES Test Success! No Errors.'))
})

tape('DWRES Tests: dWeb File Always Sync', function (t) {
  var s = DWRES({
    read: req => req.callback(null, Buffer.from('hi'))
  })

  s.open(function () {
    var sync = true

    s.read(0, 2, function (err, buf) {
      t.error(err, 'DWRES Test Success! No Errors.')
      t.same(buf, Buffer.from('hi'))
      t.notOk(sync)
      t.end()
    })

    sync = false
  })
})
