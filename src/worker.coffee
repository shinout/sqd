fs = require "fs"
cp = require "child_process"

READ_HWM  = 1e5
WRITE_HWM = 1e6

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
  {input, tmpfile, command, start, end, n, hStart, hEnd, debug, stop, rhwm, whwm } = options
  commandArgs = command.split(" ")
  commandName = commandArgs.shift()
  highWaterMark_READ = if rhwm then Math.pow(10, rhwm) else READ_HWM

  rOptions =
    start : start
    highWaterMark: highWaterMark_READ
  rOptions.end = end if end

  env = deepCopy process.env
  for k,v of options when typeof v isnt "function"
    if typeof v is "boolean"
      env["sqd_" + k] = if v then "1" else "0"
    else
      env["sqd_" + k] = v
  env.sqd_map = "1"

  worker = cp.spawn(commandName, commandArgs, env: env)

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

  if tmpfile.writable
    fwriter = tmpfile
    worker.stdout.on "end", options.callback if typeof options.callback is "function"
    worker.stdout.pipe fwriter, end: false
  else
    highWaterMark_WRITE = if whwm then Math.pow(10, whwm) else WRITE_HWM
    fwriter = fs.createWriteStream tmpfile, highWaterMark: highWaterMark_WRITE
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

# deepcopy val
deepCopy = (val)->
  return val.map(deepCopy)  if Array.isArray(val)
  return val if typeof val isnt "object" or val is null or val is undefined
  ret = {}
  ret[attr] = deepCopy v for attr,v of val when val.hasOwnProperty attr
  return ret

module.exports = execute
