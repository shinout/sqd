bgzfheader = new Buffer("1f 8b 08 04 00 00 00 00 00 ff 06 00 42 43 02 00".split(" ").join(""), "hex")
fs = require "fs"
require "coffee-script/register"
BGZF_MEAN_LEN = 655360
inflateRaw = require("zlib").inflateRaw
require("termcolor").define

module.exports = (bamfile, nProcess)->
  size = (fs.statSync bamfile).size
  fails = []

  fd = fs.openSync bamfile, "r"

  # reading header
  headerBuf = new Buffer(BGZF_MEAN_LEN)
  fs.readSync fd, headerBuf, 0, BGZF_MEAN_LEN, 0
  cdataLen = headerBuf.readUInt16LE(16)- 25
  offset = cdataLen+26
  headerBuf = headerBuf.slice(0, offset)
  interval = Math.floor((size-offset)/nProcess)
  positions = []

  buflen = Math.min(BGZF_MEAN_LEN, interval)

  for k in [0...nProcess]
    # finding accurate position of BGZF
    start = interval * k + offset-1
    buf = new Buffer(buflen)
    fs.read fd, buf, 0, buflen, start
    cursor = -1
    match = false
    until match or cursor + 16 > buf.length
      cursor++
      headerCandidate = buf.slice(cursor, cursor+16)
      match = true
      for b,i in bgzfheader
        if b isnt headerCandidate[i]
          match = false
          break

    if match
      positions.push(start + cursor)
    else
      fails.push k


  fs.closeSync(fd)
  header   : [0, offset]
  positions: positions
  size     : size
  interval : interval
  fails    : if fails.length then fails else null

if require.main is module
    n = Number process.argv[3]
    n = 4 if isNaN n
    console.log JSON.stringify module.exports process.argv[2], n
