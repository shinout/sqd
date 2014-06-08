bgzfheader = new Buffer("1f 8b 08 04 00 00 00 00 00 ff 06 00 42 43 02 00".split(" ").join(""), "hex")
fs = require "fs"
BGZF_MEAN_LEN = 655360
inflateRaw = require("zlib").inflateRaw

module.exports = (bamfile, nProcess, cb)->
  verboseInfo =
    bgzfheaders: {}

  size = (fs.statSync bamfile).size
  fails = []
  fd = fs.openSync bamfile, "r"

  ###
  # getting header
  ###
  defBuf = new Buffer(0)
  infBuf = new Buffer(0)
  delta = 0
  offset = 0

  getHeader = ->
    loop
      if defBuf.length < 26
        _defBuf = new Buffer(BGZF_MEAN_LEN)
        fs.readSync fd, _defBuf, 0, BGZF_MEAN_LEN, offset
        defBuf = Buffer.concat [defBuf, _defBuf]

      delta = defBuf.readUInt16LE(16) + 1
      if defBuf.length < delta
        _defBuf = new Buffer(BGZF_MEAN_LEN)
        fs.readSync fd, _defBuf, 0, BGZF_MEAN_LEN, offset
        defBuf = Buffer.concat [defBuf, _defBuf]
        continue
      break

    offset += delta
    bufToInflate = defBuf.slice(18, delta-8)
    defBuf = defBuf.slice(delta)

    inflateRaw bufToInflate, (e, _infBuf)->
      #console.error e if e
      infBuf = Buffer.concat [infBuf, _infBuf]
      headerLen = infBuf.readInt32LE(4)
      return getHeader() if infBuf.length < headerLen + 12

      header = infBuf.slice(8, headerLen + 8).toString("ascii")
      nRef = infBuf.readInt32LE headerLen + 8
      cursor = headerLen + 12

      try
        for i in [0...nRef]
          nameLen = infBuf.readInt32LE cursor
          cursor+=nameLen + 8
      catch e
        #console.error e
        return getHeader()

      return splitBody()

  getHeader()

  ###
  # split body
  ###
  splitBody = ->
    interval = Math.floor((size-offset)/nProcess)
    positions = []

    buflen = Math.min(BGZF_MEAN_LEN, interval)

    for k in [0...nProcess]
      # finding accurate position of BGZF
      start = interval * k + offset-1
      buf = new Buffer(buflen)
      fs.readSync fd, buf, 0, buflen, start
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

      verboseInfo.bgzfheaders[k] = bgzfheader.toString("hex")
      if match
        positions.push(start + cursor)
      else
        fails.push k


    fs.closeSync(fd)

    cb null,
      header   : [0, offset]
      positions: positions
      size     : size
      interval : interval
      fails    : if fails.length then fails else null
      verbose  : verboseInfo

if require.main is module
    n = Number process.argv[3]
    n = 4 if isNaN n
    console.log JSON.stringify module.exports process.argv[2], n
