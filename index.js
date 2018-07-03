var dwresEvents = require('events')
var inherits = require('inherits')

var DPACK_UNREADABLE = dWebDefaultImpl(new Error('dPack configuration does not allow for read permissions'))
var DPACK_UNWRITABLE = dWebDefaultImpl(new Error('dPack configuration does not allow for write permissions'))
var DPACK_UNREMOVABLE = dWebDefaultImpl(new Error('dPack cannot be removed!'))
var DPACK_UNTRACKABLE = dWebDefaultImpl(new Error('dPack can not be tracked and stats are unable to be retrieved'))
var DPACK_OPEN_READONLY = dWebDefaultImpl(new Error('dPack does not have read only open'))

module.exports = DWebRandEntry

function DWebRandEntry (opts) {
  if (!(this instanceof DWebRandEntry)) return new DWebRandEntry(opts)
  dwresEvents.EventEmitter.call(this)

  this._queued = []
  this._pending = 0

  this._dWebNeedsOpen = true
  this.dWebOpened = false
  this.dWebClosed = false

  if (opts) {
    if (opts.dWebOpenReadonly) this._dWebOpenReadonly = opts.dWebOpenReadonly
    if (opts.dWebOpen) this._dWebOpen = opts.dWebOpen
    if (opts.dWebRead) this._dWebRead = opts.dWebRead
    if (opts.dWebWrite) this._dWebWrite = opts.dWebWrite
    if (opts.dWebRemove) this._dWebRemove = opts.dWebRemove
    if (opts.dWebStat) this._dWebStat = opts.dWebStat
    if (opts.dWebClose) this._dWebClose = opts.dWebClose
    if (opts.dWebKill) this._dWebKill = opts.dWebKill
  }

  this.dWebPreferReadonly = this._dWebOpenReadonly !== DPACK_OPEN_READONLY
  this.dWebReadable = this._dWebRead !== DPACK_UNREADABLE
  this.dWebWritable = this._dWebWrite !== DPACK_UNWRITABLE
  this.dWebRemovable = this._dWebRemove !== DPACK_UNREMOVABLE
  this.dWebStatable = this._dWebStat !== DPACK_UNTRACKABLE
}

inherits(DWebRandEntry, dwresEvents.EventEmitter)

DWebRandEntry.prototype.dWebOpen = function (cb) {
  if (!cb) cb = noop
  if (this.dWebOpened && !this._dWebNeedsOpen) return process.nextTick(cb, null)
  queueAndRun(this, new DWREStorageRequest(this, 0, 0, 0, null, cb))
}

DWebRandEntry.prototype._dWebOpen = dWebDefaultImpl(null)
DWebRandEntry.prototype._dWebOpenReadonly = DPACK_OPEN_READONLY

DWebRandEntry.prototype.dWebRead = function (offset, size, cb) {
  this.run(new DWREStorageRequest(this, 1, offset, size, null, cb))
}

DWebRandEntry.prototype._dWebRead = DPACK_UNREADABLE

DWebRandEntry.prototype.dWebWrite = function (offset, data, cb) {
  if (!cb) cb = noop
  dWebOpenWritable(this)
  this.run(new DWREStorageRequest(this, 2, offset, data.length, data, cb))
}

DWebRandEntry.prototype._dWebWrite = DPACK_UNWRITABLE

DWebRandEntry.prototype.dWebRemove = function (offset, size, cb) {
  if (!cb) cb = noop
  dWebOpenWritable(this)
  this.run(new DWREStorageRequest(this, 3, offset, size, null, cb))
}

DWebRandEntry.prototype._dWebRemove = DPACK_UNREMOVABLE

DWebRandEntry.prototype.dWebStat = function (cb) {
  this.run(new DWREStorageRequest(this, 4, 0, 0, null, cb))
}

DWebRandEntry.prototype._dWebStat = DPACK_UNTRACKABLE

DWebRandEntry.prototype.dWebClose = function (cb) {
  if (!cb) cb = noop
  if (this.dWebClosed) return process.nextTick(cb, null)
  queueAndRun(this, new DWREStorageRequest(this, 5, 0, 0, null, cb))
}

DWebRandEntry.prototype._dWebClose = dWebDefaultImpl(null)

DWebRandEntry.prototype.dWebKill = function (cb) {
  if (!cb) cb = noop
  if (!this.dWebClosed) this.dWebClose(noop)
  queueAndRun(this, new DWREStorageRequest(this, 6, 0, 0, null, cb))
}

DWebRandEntry.prototype._dWebKill = dWebDefaultImpl(null)

DWebRandEntry.prototype.run = function (req) {
  if (this._dWebNeedsOpen) this.dWebOpen(noop)
  if (this._queued.length) this._queued.push(req)
  else req._run()
}

function noop () {}

function DWREStorageRequest (self, type, offset, size, data, cb) {
  this.type = type
  this.offset = offset
  this.data = data
  this.size = size
  this.storage = self

  this._sync = false
  this._callback = cb
}

DWREStorageRequest.prototype._unqueue = function (err) {
  var dWebStorage = this.storage
  var queued = dWebStorage._queued

  if (!err) {
    switch (this.type) {
      case 0:
        if (!dWebStorage.dWebOpened) {
          dWebStorage.dWebOpened = true
          dWebStorage.emit('dWeb MemStorage Opened')
        }
        break

      case 5:
        if (!dWebStorage.dWebClosed) {
          dWebStorage.dWebClosed = true
          dWebStorage.emit('dWeb MemStorage Closed')
        }
        break

      case 6:
        if (!dWebStorage.dWebKilled) {
          dWebStorage.dWebKilled = true
          dWebStorage.emit('dWeb MemStorage Killed')
        }
        break
    }
  }

  if (queued.length && queued[0] === this) queued.shift()
  if (!--dWebStorage._pending && queued.length) queued[0]._run()
}

DWREStorageRequest.prototype.callback = function (err, val) {
  if (this._sync) return nextTick(this, err, val)
  this._unqueue(err)
  this._callback(err, val)
}

DWREStorageRequest.prototype._dWebOpenAndNotClosed = function () {
  var dWebStorage = this.storage
  if (dWebStorage.dWebOpened && !dWebStorage.dWebClosed) return true
  if (!dWebStorage.dWebOpened) nextTick(this, new Error('dWeb MemFile Was Opened'))
  else if (dWebStorage.dWebClosed) nextTick(this, new Error('dWeb MemFile Was Closed'))
  return false
}

DWREStorageRequest.prototype._dWebOpen = function () {
  var dWebStorage = this.storage

  if (dWebStorage.dWebOpened && !dWebStorage._dWebNeedsOpen) return nextTick(this, null)
  if (dWebStorage.dWebClosed) return nextTick(this, new Error('dWeb MemFile Was Closed'))

  dWebStorage._dWebNeedsOpen = false
  if (dWebStorage.dWebPreferReadonly) dWebStorage._dWebOpenReadonly(this)
  else dWebStorage._dWebOpen(this)
}

DWREStorageRequest.prototype._run = function () {
  var dWebStorage = this.storage
  dWebStorage._pending++

  this._sync = true

  switch (this.type) {
    case 0:
      this._dWebOpen()
      break

    case 1:
      if (this._dWebOpenAndNotClosed()) dWebStorage._dWebRead(this)
      break

    case 2:
      if (this._dWebOpenAndNotClosed()) dWebStorage._dWebWrite(this)
      break

    case 3:
      if (this._dWebOpenAndNotClosed()) dWebStorage._dWebRemove(this)
      break

    case 4:
      if (this._dWebOpenAndNotClosed()) dWebStorage._dWebStat(this)
      break

    case 5:
      if (dWebStorage.dWebClosed || !dWebStorage.dWebOpened) nextTick(this, null)
      else dWebStorage._dWebClose(this)
      break

    case 6:
      if (dWebStorage.dWebKilled) nextTick(this, null)
      else dWebStorage._dWebKill(this)
      break
  }

  this._sync = false
}

function queueAndRun (self, req) {
  self._queued.push(req)
  if (!self._pending) req._run()
}

function dWebOpenWritable (self) {
  if (self.dWebPreferReadonly) {
    self._dWebNeedsOpen = true
    self.dWebPreferReadonly = false
  }
}

function dWebDefaultImpl (err) {
  return dWebOverridable

  function dWebOverridable (req) {
    nextTick(req, err)
  }
}

function nextTick (req, err, val) {
  process.nextTick(nextTickCallback, req, err, val)
}

function nextTickCallback (req, err, val) {
  req.callback(err, val)
}
