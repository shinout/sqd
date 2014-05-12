fs = require "fs"
MEAN_LINE_LEN = 1024
module.exports = (file, num)->
  size = (fs.statSync file).size
  interval = Math.floor(size/num)
  positions = [0]
  fd = fs.openSync file, "r"

  for k in [1...num]
    prev = positions[k-1] or -1
    start = Math.max(interval * k, prev)

    while start <= size
      buf = new Buffer(MEAN_LINE_LEN)
      fs.readSync fd, buf, 0, MEAN_LINE_LEN, start
      lines = buf.toString().split("\n")
      if lines.length > 1
        positions.push start + lines[0].length + 1
        break
      start += MEAN_LINE_LEN

  header   : null
  footer   : null
  positions: positions

if require.main is module
    n = Number process.argv[3]
    n = 4 if isNaN n
    console.log JSON.stringify module.exports process.argv[2], n
