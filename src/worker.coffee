fs = require "fs"
cp = require "child_process"

READ_HWM  = 1e6
WRITE_HWM = 1e8

error = (streamName, exit)->
  return (e)->
    console.error "[ERROR] #{streamName} :"
    console.error e.stack
    process.exit(1) if exit

showStderr = (stderr, name, exit)->
  return if stderr is process.stderr
  stderr.setEncoding "utf-8"
  stderr.on "data", (data)->
    console.error "STDERR in #{name}:"
    console.error data
    process.exit(1) if exit

execute = (options)->
  {input, tmpfile, command, start, end, n, hStart, hEnd, debug, stop } = options
  commandArgs = command.split(" ")
  commandName = commandArgs.shift()

  rOptions =
    start : start
    highWaterMark: READ_HWM
  rOptions.end = end if end

  worker = cp.spawn(commandName, commandArgs)

  # registering error
  worker.stdout.on "error", error "givenCommand#{n}.stdout", stop
  worker.stdin.on "error", error "givenCommand#{n}.stdin", stop
  worker.on "error", error "givenCommand#{n}", stop
  showStderr worker.stderr, "givenCommand#{n}", stop

  if debug
    worker.on "exit", (code, signal)->
      console.error "process #{n} onExit  code:#{code}, #{signal}"
    worker.on "close", (code, signal)->
      console.error "process #{n} onClose  code:#{code}, #{signal}"
    worker.on "disconnect", (code, signal)->
      console.error "process #{n} onDisconnect"

  if tmpfile is "-"
    fwriter = process.stdout
    worker.stdout.on "end", options.callback if typeof options.callback is "function"
    worker.stdout.pipe fwriter, end: false
  else
    fwriter = fs.createWriteStream tmpfile, highWaterMark: WRITE_HWM
    fwriter.on "close", options.callback if typeof options.callback is "function"
    worker.stdout.pipe fwriter

  writer = worker.stdin

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
    freader.pipe writer

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
  .nonvals("debug", "d")
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
    debug   : ap.opt("d", "debug")
    stop    : ap.opt("stop")

  execute(op)
