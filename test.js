var tape = require('tape')
var dwRES = require('./')

tape('dwRES Tests: dWeb File Simple Read', function (t) {
  t.plan(2 * 4 + 4)

  var expected = [Buffer.from('hi'), Buffer.from('ho')]
  var queued = expected.slice(0)
  var s = dwRES({
    dWebRead: function (req) {
      process.nextTick(function () {
        t.same(req.offset, 0)
        t.same(req.size, 2)
        req.callback(null, queued.shift())
      })
    }
  })

  t.ok(s.dWebReadable)
  t.notOk(s.dWebWritable)
  t.notOk(s.dWebRemovable)
  t.notOk(s.dWebStatable)
  s.dWebRead(0, 2, dWebOnData)
  s.dWebRead(0, 2, dWebOnData)

  function dWebOnData (err, data) {
    t.error(err, 'dwRES Test Success! No Errors.')
    t.same(data, expected.shift())
  }
})

tape('dwRES Tests: dWeb File Simple Write', function (t) {
  t.plan(2 * 2 + 4)

  var expected = [Buffer.from('hi'), Buffer.from('ho')]
  var s = dwRES({
    dWebWrite: function (req) {
      t.same(req.data, expected.shift())
      req.callback(null)
    }
  })

  t.notOk(s.dWebReadable)
  t.ok(s.dWebWritable)
  t.notOk(s.dWebRemovable)
  t.notOk(s.dWebStatable)
  s.dWebWrite(0, Buffer.from('hi'), dWebOnWrite)
  s.dWebWrite(0, Buffer.from('ho'), dWebOnWrite)

  function dWebOnWrite (err, write) {
    t.error(err, 'dwRES Test Success! No Errors.')
  }
})

tape('dwRES Tests: dWeb File Simple Delete', function (t) {
  t.plan(2 + 2 * 3 + 4)

  var s = dwRES({
    dWebRemove: function (req) {
      t.same(req.offset, 0)
      t.same(req.size, 2)
      req.callback(null)
    }
  })

  t.notOk(s.dWebReadable)
  t.notOk(s.dWebWritable)
  t.ok(s.dWebRemovable)
  t.notOk(s.dWebStatable)
  s.dWebRemove(0, 2, dWebOnRemove)
  s.dWebRemove(0, 2, dWebOnRemove)
  s.dWebRemove(0, 2) // cb is optional

  function dWebOnRemove (err) {
    t.error(err, 'dwRES Test Success! No Errors.')
  }
})

tape('dwRES Tests: dWeb File Basic Stat', function (t) {
  t.plan(2 * 2 + 4)

  var s = dwRES({
    dWebStat: function (req) {
      req.callback(null, {size: 42})
    }
  })

  t.notOk(s.dWebReadable)
  t.notOk(s.dWebWritable)
  t.notOk(s.dWebRemovable)
  t.ok(s.dWebStatable)
  s.dWebStat(dWebOnStat)
  s.dWebStat(dWebOnStat)

  function dWebOnStat (err, st) {
    t.error(err, 'dwRES Test Success! No Errors.')
    t.same(st, {size: 42})
  }
})

tape('dwRES Tests: dWeb File With No Options (opts)', function (t) {
  var s = dwRES()

  t.notOk(s.dWebReadable)
  t.notOk(s.dWebWritable)
  t.notOk(s.dWebRemovable)
  t.notOk(s.dWebStatable)
  t.end()
})

tape('dwRES Tests: dWeb File Only Opens Once With Many Open Calls', function (t) {
  t.plan(1)

  var s = dwRES({
    dWebOpen: function (req) {
      process.nextTick(function () {
        t.pass('dwRES Test Success! File Is Opening.')
        req.callback(null)
      })
    }
  })

  s.dWebOpen()
  s.dWebOpen()
  s.dWebOpen()
  s.dWebOpen()
  s.dWebOpen()
  setImmediate(() => s.dWebOpen())
})

tape('dwRES Tests: dWeb File Open Errors', function (t) {
  t.plan(3 + 2)

  var s = dwRES({
    dWebOpen: function (req) {
      t.pass('dwRES Test Success! File Opened.')
      setImmediate(() => req.callback(new Error('nope')))
    },
    dWebWrite: function (req) {
      t.fail('dwRES Test Failed! Should Not Get Here!')
      req.callback(null)
    }
  })

  s.dWebWrite(0, Buffer.from('hi'), dWebOnWrite)
  s.dWebWrite(0, Buffer.from('hi'), dWebOnWrite)
  s.dWebWrite(0, Buffer.from('hi'), dWebOnWrite)
  s.dWebOpen() // should try and open again

  function dWebOnWrite (err) {
    t.same(err, new Error('dwRES Test Failed! File Did Not Open!'))
  }
})

tape('dwRES Tests: dWeb File Open Before Read', function (t) {
  t.plan(5 * 2 + 1 + 1)

  var open = false
  var s = dwRES({
    dWebOpen: function (req) {
      t.ok(!open, 'dwRES Test Success! File Only Opened Once.')
      open = true
      req.callback(null)
    },
    dWebRead: function (req) {
      t.ok(open, 'dwRES Test Success! File Is Open.')
      req.callback(null, Buffer.from('hi'))
    }
  })

  t.notOk(s.dWebOpened, 'dwRES Tests: dWeb File Opened But Property Not Set')
  s.dWebRead(0, 2, dWebOnData)
  s.dWebRead(0, 2, dWebOnData)

  function dWebOnData (err, data) {
    t.error(err, 'dwRES Test Failed!')
    t.ok(open, 'dwRES Test Success! File Opened.')
    t.ok(s.dWebOpened, 'dwRES Test Success! File Opened and Property Not Set.')
    t.same(data, Buffer.from('hi'))
  }
})

tape('dwRES Tests: dWeb File Close', function (t) {
  t.plan(6)

  var s = dwRES({
    dWebClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    }
  })

  s.on('dWebClosed', () => t.pass('dwRES Test Success! Close Command Sent.'))
  s.dWebOpen()
  s.dWebClose()
  s.dWebClose()
  s.dWebClose(function () {
    t.pass('dwRES Test Success! File Called Callback.')
  })

  s.dWebRead(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebStat(err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebWrite(0, Buffer.from('hi'), err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebRemove(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
})

tape('dwRES Tests: dWeb File Close Only If Open', function (t) {
  t.plan(5)

  var s = dwRES({
    dWebClose: req => t.fail('dwRES Test Failed! Only Close When Open!')
  })

  s.dWebClose()
  s.dWebClose()
  s.dWebClose(function () {
    t.pass('dwRES Test Success! File Called Callback.')
  })

  s.dWebRead(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebStat(err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebWrite(0, Buffer.from('hi'), err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebRemove(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
})

tape('dwRES Tests: dWeb File Kill', function (t) {
  t.plan(3)

  var s = dwRES({
    dWebOpen: req => t.fail('dwRES Test Failed! File Did Not Open!'),
    dWebKill: function (req) {
      t.pass('dwRES Test Success! File Killed.')
      req.callback(null)
    }
  })

  s.on('Kill', () => t.pass('destroy emitted'))
  s.dWebKill()
  s.dWebKill(function (err) {
    t.error(err, 'dwRES Test Success! No Errors.')
    t.pass('dwRES Test Success! File Callback Called.')
  })
})

tape('dwRES Tests: dWeb File Kill But Closes First', function (t) {
  t.plan(2)

  var s = dwRES({
    dWebClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    },
    dWebKill: function (req) {
      t.ok(s.dWebClosed, 'dwRES Test Success! File Is Closing')
      req.callback(null)
    }
  })

  s.dWebOpen()
  s.dWebKill()
})

tape('dwRES Tests: dWeb File Kill With Explicit Close First', function (t) {
  t.plan(2)

  var s = dwRES({
    dWebClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    },
    dWebKill: function (req) {
      t.ok(s.dWebClosed, 'dwRES Test Success! File Is Closing')
      req.callback(null)
    }
  })

  s.dWebOpen()
  s.dWebClose()
  s.dWebKill()
})

tape('dwRES Tests: dWeb File Open and Close', function (t) {
  t.plan(7)

  var s = dwRES({
    dWebOpen: function (req) {
      t.pass('dwRES Test Success! File Opening.')
      req.callback(null)
    },
    dWebClose: function (req) {
      t.pass('dwRES Test Success! File Closing.')
      req.callback(null)
    }
  })

  s.dWebOpen()
  s.dWebClose()
  s.dWebClose()
  s.dWebClose(function () {
    t.pass('dwRES Test Success! File Callback Called.')
  })

  s.dWebRead(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebStat(err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebWrite(0, Buffer.from('hi'), err => t.same(err, new Error('dWeb MemFile Was Closed')))
  s.dWebRemove(0, 10, err => t.same(err, new Error('dWeb MemFile Was Closed')))
})

tape('dwRES Tests: dWeb File Write and Close.', function (t) {
  t.plan(1 + 5 + 1 + 3)

  var dPClosed = false
  var s = dwRES({
    dWebOpen: function (req) {
      t.pass('dwRES Test Success! File Opened.')
      req.callback(null)
    },
    dWebWrite: function (req) {
      t.pass('dwRES Test Success! File Was Written To.')
      process.nextTick(function () {
        req.callback(null)
      })
    },
    dWebClose: function (req) {
      t.notOk(dPClosed, 'dwRES Test Failed! File Did Not Close!')
      dPClosed = true
      req.callback(null)
    }
  })

  s.dWebWrite(0, Buffer.from('hi'))
  s.dWebWrite(0, Buffer.from('hi'))
  s.dWebWrite(0, Buffer.from('hi'))
  s.dWebWrite(0, Buffer.from('hi'))
  s.dWebWrite(0, Buffer.from('hi'))
  s.dWebClose(err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dWebClose(err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dWebClose(err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dWeb File Open Read Only', function (t) {
  t.plan(2)

  var s = dwRES({
    dWebOpen: () => t.fail('dwRES Test Failed: Did Not Open!'),
    dWebOpenReadonly: function (req) {
      t.pass('dwRES Test Success! File Opened.')
      req.callback(null)
    },
    dWebRead: req => req.callback(null, Buffer.from('hi'))
  })

  s.dWebOpen()
  s.dWebRead(0, 10, err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dWeb File Open Read Only Then Write', function (t) {
  t.plan(4)

  var dWebReadonlyFirst = true

  var s = dwRES({
    dWebOpen: function (req) {
      t.notOk(dWebReadonlyFirst, 'dwRES Test Failed. Open Read Only First')
      req.callback(null)
    },
    dWebOpenReadonly: function (req) {
      t.ok(dWebReadonlyFirst, 'dwRES Test Failed. Open Read Only First')
      dWebReadonlyFirst = false
      req.callback(null)
    },
    dWebRead: req => req.callback(null, Buffer.from('hi')),
    dWebWrite: req => req.callback(null)
  })

  s.dWebOpen()
  s.dWebRead(0, 2, err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dWebWrite(0, Buffer.from('hi'), err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dWeb File Open ReadOnly Is Ignored When First Option Is Write', function (t) {
  t.plan(3)

  var s = dwRES({
    dWebOpen: function (req) {
      t.pass('dwRES Test Success! dWeb File Should Open')
      req.callback(null)
    },
    dWebOpenReadonly: req => t.fail('dwREST Test Failed: First Option Is A Write.'),
    dWebRead: req => req.callback(null, Buffer.from('hi')),
    dWebWrite: req => req.callback(null)
  })

  s.dWebWrite(0, Buffer.from('hi'), err => t.error(err, 'dwRES Test Success! No Errors.'))
  s.dWebRead(0, 2, err => t.error(err, 'dwRES Test Success! No Errors.'))
})

tape('dwRES Tests: dWeb File Always Sync', function (t) {
  var s = dwRES({
    dWebRead: req => req.callback(null, Buffer.from('hi'))
  })

  s.dWebOpen(function () {
    var sync = true

    s.dWebRead(0, 2, function (err, buf) {
      t.error(err, 'dwRES Test Success! No Errors.')
      t.same(buf, Buffer.from('hi'))
      t.notOk(sync)
      t.end()
    })

    sync = false
  })
})
