var dwresEvents = require('events')
var inherits = require('inherits')

var DPACK_UNREADABLE = dPackDefaultImpl(new Error('dPack configuration does not allow for read permissions'))
var DPACK_UNWRITABLE = dPackDefaultImpl(new Error('dPack configuration does not allow for write permissions'))
var DPACK_UNREMOVABLE = dPackDefaultImpl(new Error('dPack cannot be removed!'))
var DPACK_UNTRACKABLE = dPackDefaultImpl(new Error('dPack can not be tracked and stats are unable to be retrieved'))
var DPACK_OPEN_READONLY = dPackDefaultImpl(new Error('dPack does not have read only open'))

module.exports = DWebRandEntry

function DWebRandEntry (opts) {
  if (!(this instanceof DWebRandEntry)) return new DWebRandEntry(opts)
  dwresEvents.EventEmitter.call(this)

  this._queued = []
  this._pending = 0

  this._dPackNeedsOpen = true
  this.dPackOpened = false
  this.dPackClosed = false

  if (opts) {
    if (opts.dPackOpenReadonly) this._dPackOpenReadonly = opts.dPackOpenReadonly
    if (opts.dPackOpen) this._dPackOpen = opts.dPackOpen
    if (opts.dPackRead) this._dPackRead = opts.dPackRead
    if (opts.dPackWrite) this._dPackWrite = opts.dPackWrite
    if (opts.dPackRemove) this._dPackRemove = opts.dPackRemove
    if (opts.dPackStat) this._dPackStat = opts.dPackStat
    if (opts.dPackClose) this._dPackClose = opts.dPackClose
    if (opts.dPackKill) this._dPackKill = opts.dPackKill
  }

  this.dPackPreferReadonly = this._dPackOpenReadonly !== DPACK_OPEN_READONLY
  this.dPackReadable = this._dPackRead !== DPACK_UNREADABLE
  this.dPackWritable = this._dPackWrite !== DPACK_UNWRITABLE
  this.dPackRemovable = this._dPackRemove !== DPACK_UNREMOVABLE
  this.dPackStatable = this._dPackStat !== DPACK_UNTRACKABLE
}

inherits(DWebRandEntry, dwresEvents.EventEmitter)

DWebRandEntry.prototype.dPackOpen = function (cb) {
  if (!cb) cb = noop
  if (this.dPackOpened && !this._dPackNeedsOpen) return process.nextTick(cb, null)
  queueAndRun(this, new DWREStorageRequest(this, 0, 0, 0, null, cb))
}

DWebRandEntry.prototype._dPackOpen = dPackDefaultImpl(null)
DWebRandEntry.prototype._dPackOpenReadonly = DPACK_OPEN_READONLY

DWebRandEntry.prototype.dPackRead = function (offset, size, cb) {
  this.run(new DWREStorageRequest(this, 1, offset, size, null, cb))
}

DWebRandEntry.prototype._dPackRead = DPACK_UNREADABLE

DWebRandEntry.prototype.dPackWrite = function (offset, data, cb) {
  if (!cb) cb = noop
  dPackOpenWritable(this)
  this.run(new DWREStorageRequest(this, 2, offset, data.length, data, cb))
}

DWebRandEntry.prototype._dPackWrite = DPACK_UNWRITABLE

DWebRandEntry.prototype.dPackRemove = function (offset, size, cb) {
  if (!cb) cb = noop
  dPackOpenWritable(this)
  this.run(new DWREStorageRequest(this, 3, offset, size, null, cb))
}

DWebRandEntry.prototype._dPackRemove = DPACK_UNREMOVABLE

DWebRandEntry.prototype.dPackStat = function (cb) {
  this.run(new DWREStorageRequest(this, 4, 0, 0, null, cb))
}

DWebRandEntry.prototype._dPackStat = DPACK_UNTRACKABLE

DWebRandEntry.prototype.dPackClose = function (cb) {
  if (!cb) cb = noop
  if (this.dPackClosed) return process.nextTick(cb, null)
  queueAndRun(this, new DWREStorageRequest(this, 5, 0, 0, null, cb))
}

DWebRandEntry.prototype._dPackClose = dPackDefaultImpl(null)

DWebRandEntry.prototype.dPackKill = function (cb) {
  if (!cb) cb = noop
  if (!this.dPackClosed) this.dPackClose(noop)
  queueAndRun(this, new DWREStorageRequest(this, 6, 0, 0, null, cb))
}

DWebRandEntry.prototype._dPackKill = dPackDefaultImpl(null)

DWebRandEntry.prototype.run = function (req) {
  if (this._dPackNeedsOpen) this.dPackOpen(noop)
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
  var dPackStorage = this.storage
  var queued = dPackStorage._queued

  if (!err) {
    switch (this.type) {
      case 0:
        if (!dPackStorage.dPackOpened) {
          dPackStorage.dPackOpened = true
          dPackStorage.emit('dPack MemStorage Opened')
        }
        break

      case 5:
        if (!dPackStorage.dPackClosed) {
          dPackStorage.dPackClosed = true
          dPackStorage.emit('dPack MemStorage Closed')
        }
        break

      case 6:
        if (!dPackStorage.dPackKilled) {
          dPackStorage.dPackKilled = true
          dPackStorage.emit('dPack MemStorage Killed')
        }
        break
    }
  }

  if (queued.length && queued[0] === this) queued.shift()
  if (!--dPackStorage._pending && queued.length) queued[0]._run()
}

DWREStorageRequest.prototype.callback = function (err, val) {
  if (this._sync) return nextTick(this, err, val)
  this._unqueue(err)
  this._callback(err, val)
}

DWREStorageRequest.prototype._dPackOpenAndNotClosed = function () {
  var dPackStorage = this.storage
  if (dPackStorage.dPackOpened && !dPackStorage.dPackClosed) return true
  if (!dPackStorage.dPackOpened) nextTick(this, new Error('dPack MemFile Was Opened'))
  else if (dPackStorage.dPackClosed) nextTick(this, new Error('dPack MemFile Was Closed'))
  return false
}

DWREStorageRequest.prototype._dPackOpen = function () {
  var dPackStorage = this.storage

  if (dPackStorage.dPackOpened && !dPackStorage._dPackNeedsOpen) return nextTick(this, null)
  if (dPackStorage.dPackClosed) return nextTick(this, new Error('dPack MemFile Was Closed'))

  dPackStorage._dPackNeedsOpen = false
  if (dPackStorage.dPackPreferReadonly) dPackStorage._dPackOpenReadonly(this)
  else dPackStorage._dPackOpen(this)
}

DWREStorageRequest.prototype._run = function () {
  var dPackStorage = this.storage
  dPackStorage._pending++

  this._sync = true

  switch (this.type) {
    case 0:
      this._dPackOpen()
      break

    case 1:
      if (this._dPackOpenAndNotClosed()) dPackStorage._dPackRead(this)
      break

    case 2:
      if (this._dPackOpenAndNotClosed()) dPackStorage._dPackWrite(this)
      break

    case 3:
      if (this._dPackOpenAndNotClosed()) dPackStorage._dPackRemove(this)
      break

    case 4:
      if (this._dPackOpenAndNotClosed()) dPackStorage._dPackStat(this)
      break

    case 5:
      if (dPackStorage.dPackClosed || !dPackStorage.dPackOpened) nextTick(this, null)
      else dPackStorage._dPackClose(this)
      break

    case 6:
      if (dPackStorage.dPackKilled) nextTick(this, null)
      else dPackStorage._dPackKill(this)
      break
  }

  this._sync = false
}

function queueAndRun (self, req) {
  self._queued.push(req)
  if (!self._pending) req._run()
}

function dPackOpenWritable (self) {
  if (self.dPackPreferReadonly) {
    self._dPackNeedsOpen = true
    self.dPackPreferReadonly = false
  }
}

function dPackDefaultImpl (err) {
  return dPackOverridable

  function dPackOverridable (req) {
    nextTick(req, err)
  }
}

function nextTick (req, err, val) {
  process.nextTick(nextTickCallback, req, err, val)
}

function nextTickCallback (req, err, val) {
  req.callback(err, val)
}
