fs = require "fs"
MEAN_FQ_SIZE = 1000
module.exports = (file, num)->
  size = (fs.statSync file).size
  interval = Math.floor(size/num)
  positions = [0]
  fd = fs.openSync file, "r"

  for k in [1...num]
    prev = positions[k-1] or -1
    start = Math.max(interval * k, prev)

    while start <= size
      buf = new Buffer(MEAN_FQ_SIZE)
      fs.readSync fd, buf, 0, MEAN_FQ_SIZE, start
      lines = buf.toString().split("\n")

      key = null
      for line,k in lines
        if line is "+"
          console.log line,k, lines.length
          key = k + 1
          break

      if lines[key]
        length = 0
        length += lines[i].length + 1 for i in [0..key]
        positions.push start + length
        break

      start += MEAN_FQ_SIZE

  header   : null
  footer   : null
  positions: positions

if require.main is module
    n = Number process.argv[3]
    n = 4 if isNaN n
    console.log JSON.stringify module.exports process.argv[2], n
