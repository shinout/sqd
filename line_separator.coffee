fs = require "fs"
MEAN_LINE_LEN = 1024
module.exports = (file, num)->
  size = (fs.statSync file).size
  interval = Math.floor(size/num)
  positions = [0]
  fd = fs.openSync file, "r"

  for k in [1...num]
    start = interval * k

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
