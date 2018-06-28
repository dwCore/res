var dWebRandEntry = require('./')
var fs = require('fs')

var dPackFile = dPackFileReader('index.js')

dPackFile.dPackRead(0, 10, (_, buf) => console.log('0-10: ' + buf.toString()))
dPackFile.dPackRead(40, 15, (_, buf) => console.log('40-55: ' + buf.toString()))
dPackFile.dPackClose()

function dPackFileReader (dPackFileName) {
  var fd = 0
  return dWebRandEntry({
    dPackOpen: function (req) {
      fs.dPackOpen(dPackFileName, 'r', function (err, res) {
        if (err) return req.callback(err)
        fd = res
        req.callback(null)
      })
    },
    dPackRead: function (req) {
      var buf = Buffer.allocUnsafe(req.size)
      fs.dPackRead(fd, buf, 0, buf.length, req.offset, function (err, dPackRead) {
        if (err) return req.callback(err)
        if (dPackRead < buf.length) return req.callback(new Error('Unable To Read From Memory'))
        req.callback(null, buf)
      })
    },
    dPackClose: function (req) {
      if (!fd) return req.callback(null)
      fs.dPackClose(fd, err => req.callback(err))
    }
  })
}
