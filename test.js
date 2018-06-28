var tape = require('tape')
var dwRES = require('./')

tape('dwRES Tests: dPack File Simple Read', function (t) {
  t.plan(2 * 4 + 4)

  var expected = [Buffer.from('hi'), Buffer.from('ho')]
  var queued = expected.slice(0)
  var s = dwRES({
    dPackRead: function (req) {
      process.nextTick(function () {
        t.same(req.offset, 0)
        t.same(req.size, 2)
        req.callback(null, queued.shift())
      })
    }
  })

  t.ok(s.dPackReadable)
  t.notOk(s.dPackWritable)
  t.notOk(s.dPackRemovable)
  t.notOk(s.dPackStatable)
  s.dPackRead(0, 2, dPackOnData)
  s.dPackRead(0, 2, dPackOnData)

  function dPackOnData (err, data) {
    t.error(err, 'dwRES Test Success! No Errors.')
    t.same(data, expected.shift())
  }
})

tape('dwRES Tests: dPack File Simple Write', function (t) {
  t.plan(2 * 2 + 4)

  var expected = [Buffer.from('hi'), Buffer.from('ho')]
  var s = dwRES({
    dPackWrite: function (req) {
      t.same(req.data, expected.shift())
      req.callback(null)
    }
  })

  t.notOk(s.dPackReadable)
  t.ok(s.dPackWritable)
  t.notOk(s.dPackRemovable)
  t.notOk(s.dPackStatable)
  s.dPackWrite(0, Buffer.from('hi'), dPackOnWrite)
  s.dPackWrite(0, Buffer.from('ho'), dPackOnWrite)

  function dPackOnWrite (err, write) {
    t.error(err, 'dwRES Test Success! No Errors.')
  }
})

tape('dwRES Tests: dPack File Simple Delete', function (t) {
  t.plan(2 + 2 * 3 + 4)

  var s = dwRES({
    dPackRemove: function (req) {
      t.same(req.offset, 0)
      t.same(req.size, 2)
      req.callback(null)
    }
  })

  t.notOk(s.dPackReadable)
  t.notOk(s.dPackWritable)
  t.ok(s.dPackRemovable)
  t.notOk(s.dPackStatable)
  s.dPackRemove(0, 2, dPackOnRemove)
  s.dPackRemove(0, 2, dPackOnRemove)
  s.dPackRemove(0, 2) // cb is optional

  function dPackOnRemove (err) {
    t.error(err, 'dwRES Test Success! No Errors.')
  }
})

tape('dwRES Tests: dPack File Basic Stat', function (t) {
  t.plan(2 * 2 + 4)

  var s = dwRES({
    dPackStat: function (req) {
      req.callback(null, {size: 42})
    }
  })

  t.notOk(s.dPackReadable)
  t.notOk(s.dPackWritable)
  t.notOk(s.dPackRemovable)
  t.ok(s.dPackStatable)
  s.dPackStat(dPackOnStat)
  s.dPackStat(dPackOnStat)

  function dPackOnStat (err, st) {
    t.error(err, 'dwRES Test Success! No Errors.')
    t.same(st, {size: 42})
  }
})

tape('dwRES Tests: dPack File With No Options (opts)', function (t) {
  var s = dwRES()

  t.notOk(s.dPackReadable)
  t.notOk(s.dPackWritable)
  t.notOk(s.dPackRemovable)
  t.notOk(s.dPackStatable)
  t.end()
})

tape('dwRES Tests: dPack File Only Opens Once With Many Open Calls', function (t) {
  t.plan(1)

  var s = dwRES({
    dPackOpen: function (req) {
      process.nextTick(function () {
        t.pass('dwRES Test Success! File Is Opening.')
        req.callback(null)
      })
    }
  })

  s.dPackOpen()
  s.dPackOpen()
  s.dPackOpen()
  s.dPackOpen()
  s.dPackOpen()
  setImmediate(() => s.dPackOpen())
})

tape('dwRES Tests: dPack File Open Errors', function (t) {
  t.plan(3 + 2)

  var s = dwRES({
    dPackOpen: function (req) {
      t.pass('dwRES Test Success! File Opened.')
      setImmediate(() => req.callback(new Error('nope')))
    },
    dPackWrite: function (req) {
      t.fail('dwRES Test Failed! Should Not Get Here!')
      req.callback(null)
    }
  })

  s.dPackWrite(0, Buffer.from('hi'), dPackOnWrite)
  s.dPackWrite(0, Buffer.from('hi'), dPackOnWrite)
  s.dPackWrite(0, Buffer.from('hi'), dPackOnWrite)
  s.dPackOpen() // should try and open again

  function dPackOnWrite (err) {
    t.same(err, new Error('dwRES Test Failed! File Did Not Open!'))
  }
})

tape('dwRES Tests: dPack File Open Before Read', function (t) {
  t.plan(5 * 2 + 1 + 1)

  var open = false
  var s = dwRES({
    dPackOpen: function (req) {
      t.ok(!open, 'dwRES Test Success! File Only Opened Once.')
      open = true
      req.callback(null)
    },
    dPackRead: function (req) {
      t.ok(open, 'dwRES Test Success! File Is Open.')
      req.callback(null, Buffer.from('hi'))
    }
  })

  t.notOk(s.dPackOpened, 'dwRES Tests: dPack File Opened But Property Not Set')
  s.dPackRead(0, 2, dPackOnData)
  s.dPackRead(0, 2, dPackOnData)

  function dPackOnData (err, data) {
    t.error(err, 'dwRES Test Failed!')
    t.ok(open, 'dwRES Test Success! File Opened.')
    t.ok(s.dPackOpened, 'dwRES Test Success! File Opened and Property Not Set.')
    t.same(data, Buffer.from('hi'))
  }
})

tape('dwRES Tests: dPack File Close', function (t) {
  t.plan(6)

  var s = dwRES({
    dPackClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    }
  })

  s.on('dPackClosed', () => t.pass('dwRES Test Success! Close Command Sent.'))
  s.dPackOpen()
  s.dPackClose()
  s.dPackClose()
  s.dPackClose(function () {
    t.pass('dwRES Test Success! File Called Callback.')
  })

  s.dPackRead(0, 10, err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackStat(err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackWrite(0, Buffer.from('hi'), err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackRemove(0, 10, err => t.same(err, new Error('dPack MemFile Was Closed')))
})

tape('dwRES Tests: dPack File Close Only If Open', function (t) {
  t.plan(5)

  var s = dwRES({
    dPackClose: req => t.fail('dwRES Test Failed! Only Close When Open!')
  })

  s.dPackClose()
  s.dPackClose()
  s.dPackClose(function () {
    t.pass('dwRES Test Success! File Called Callback.')
  })

  s.dPackRead(0, 10, err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackStat(err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackWrite(0, Buffer.from('hi'), err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackRemove(0, 10, err => t.same(err, new Error('dPack MemFile Was Closed')))
})

tape('dwRES Tests: dPack File Kill', function (t) {
  t.plan(3)

  var s = dwRES({
    dPackOpen: req => t.fail('dwRES Test Failed! File Did Not Open!'),
    dPackKill: function (req) {
      t.pass('dwRES Test Success! File Killed.')
      req.callback(null)
    }
  })

  s.on('Kill', () => t.pass('destroy emitted'))
  s.dPackKill()
  s.dPackKill(function (err) {
    t.error(err, 'dwRES Test Success! No Errors.')
    t.pass('dwRES Test Success! File Callback Called.')
  })
})

tape('dwRES Tests: dPack File Kill But Closes First', function (t) {
  t.plan(2)

  var s = dwRES({
    dPackClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    },
    dPackKill: function (req) {
      t.ok(s.dPackClosed, 'dwRES Test Success! File Is Closing')
      req.callback(null)
    }
  })

  s.dPackOpen()
  s.dPackKill()
})

tape('dwRES Tests: dPack File Kill With Explicit Close First', function (t) {
  t.plan(2)

  var s = dwRES({
    dPackClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    },
    dPackKill: function (req) {
      t.ok(s.dPackClosed, 'dwRES Test Success! File Is Closing')
      req.callback(null)
    }
  })

  s.dPackOpen()
  s.dPackClose()
  s.dPackKill()
})

tape('dwRES Tests: dPack File Open and Close', function (t) {
  t.plan(7)

  var s = dwRES({
    dPackOpen: function (req) {
      t.pass('dwRES Test Success! File Opening.')
      req.callback(null)
    },
    dPackClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    }
  })

  s.dPackOpen()
  s.dPackClose()
  s.dPackClose()
  s.dPackClose(function () {
    t.pass('dwRES Test Success! File Callback Called.')
  })

  s.dPackRead(0, 10, err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackStat(err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackWrite(0, Buffer.from('hi'), err => t.same(err, new Error('dPack MemFile Was Closed')))
  s.dPackRemove(0, 10, err => t.same(err, new Error('dPack MemFile Was Closed')))
})

tape('dwRES Tests: dPack File Write and Close.', function (t) {
  t.plan(1 + 5 + 1 + 3)

  var dPClosed = false
  var s = dwRES({
    dPackOpen: function (req) {
      t.pass('dwRES Test Success! File Opened.')
      req.callback(null)
    },
    dPackWrite: function (req) {
      t.pass('dwRES Test Success! File Was Written To.')
      process.nextTick(function () {
        req.callback(null)
      })
    },
    dPackClose: function (req) {
      t.notOk(dPClosed, 'dwRES Test Failed! File Did Not Close!')
      dPClosed = true
      req.callback(null)
    }
  })

  s.dPackWrite(0, Buffer.from('hi'))
  s.dPackWrite(0, Buffer.from('hi'))
  s.dPackWrite(0, Buffer.from('hi'))
  s.dPackWrite(0, Buffer.from('hi'))
  s.dPackWrite(0, Buffer.from('hi'))
  s.dPackClose(err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dPackClose(err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dPackClose(err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dPack File Open Read Only', function (t) {
  t.plan(2)

  var s = dwRES({
    dPackOpen: () => t.fail('dwRES Test Failed: Did Not Open!'),
    dPackOpenReadonly: function (req) {
      t.pass('dwRES Test Success! File Opened.')
      req.callback(null)
    },
    dPackRead: req => req.callback(null, Buffer.from('hi'))
  })

  s.dPackOpen()
  s.dPackRead(0, 10, err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dPack File Open Read Only Then Write', function (t) {
  t.plan(4)

  var dPackReadonlyFirst = true

  var s = dwRES({
    dPackOpen: function (req) {
      t.notOk(dPackReadonlyFirst, 'dwRES Test Failed. Open Read Only First')
      req.callback(null)
    },
    dPackOpenReadonly: function (req) {
      t.ok(dPackReadonlyFirst, 'dwRES Test Failed. Open Read Only First')
      dPackReadonlyFirst = false
      req.callback(null)
    },
    dPackRead: req => req.callback(null, Buffer.from('hi')),
    dPackWrite: req => req.callback(null)
  })

  s.dPackOpen()
  s.dPackRead(0, 2, err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dPackWrite(0, Buffer.from('hi'), err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dPack File Open ReadOnly Is Ignored When First Option Is Write', function (t) {
  t.plan(3)

  var s = dwRES({
    dPackOpen: function (req) {
      t.pass('dwRES Test Success! dPack File Should Open')
      req.callback(null)
    },
    dPackOpenReadonly: req => t.fail('dwREST Test Failed: First Option Is A Write.'),
    dPackRead: req => req.callback(null, Buffer.from('hi')),
    dPackWrite: req => req.callback(null)
  })

  s.dPackWrite(0, Buffer.from('hi'), err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dPackRead(0, 2, err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dPack File Always Sync', function (t) {
  var s = dwRES({
    dPackRead: req => req.callback(null, Buffer.from('hi'))
  })

  s.dPackOpen(function () {
    var sync = true

    s.dPackRead(0, 2, function (err, buf) {
      t.error(err, 'dwRES Test Success! No Errors.')
      t.same(buf, Buffer.from('hi'))
      t.notOk(sync)
      t.end()
    })

    sync = false
  })
})
