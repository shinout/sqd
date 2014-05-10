fs = require "fs"
cp = require "child_process"

READ_HWM  = 1000000
WRITE_HWM = 1024 * 1024 * 1024 -1

execute = (options)->
  {input, tmpfile, command, start, end, n, hStart, hEnd } = options
  commandArgs = command.split(" ")
  commandName = commandArgs.shift()

  rOptions =
    start : start
    highWaterMark: READ_HWM
  rOptions.end = end if end

  worker = cp.spawn(commandName, commandArgs)
  fwriter = fs.createWriteStream tmpfile, highWaterMark: WRITE_HWM
  worker.stdout.pipe(fwriter)
  writer = worker.stdin

  fwriter.on "close", options.callback if typeof options.callback is "function"

  # header
  ok = true
  if (hStart? and hEnd? and hStart isnt false and hEnd isnt false)
    fd = fs.openSync(input, "r")
    buf = new Buffer(hEnd-hStart)
    fs.readSync(fd, buf, 0, hEnd-hStart, hStart)
    ok = writer.write(buf)
    fs.closeSync(fd)

  # body
  beginReadingBody = ->
    freader = fs.createReadStream input, rOptions

    freader.on "data", (chunk)->
      writable = writer.write chunk
      if not writable
        freader.pause()
        writer.once "drain", -> freader.resume()

    freader.on "end", -> writer.end()

  if ok
    beginReadingBody()
  else
    writer.once "drain", beginReadingBody

module.exports = execute

if require.main is module
  # argument definition
  ap = require("argparser")
  .files(0)
  .arglen(2,2)
  .nums("n", "s", "e", "h", "H")
  .vals("c")
  .parse()

  op =
    input   : ap.arg(0)
    tmpfile : ap.arg(1)
    command : ap.opt("c")
    start   : ap.opt("s")
    end     : ap.opt("e")
    n       : ap.opt("n")
    hStart  : ap.opt("h")
    hEnd    : ap.opt("H")

  execute(op)
