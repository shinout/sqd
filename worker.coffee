fs = require "fs"
cp = require "child_process"

# argument definition
ap = require("argparser")
.files(0)
.arglen(2,2)
.nums("n", "s", "e", "h", "H")
.vals("c")
.parse()

input = ap.arg(0)
tmpfile = ap.arg(1)
start = ap.opt("s")
end   = ap.opt("e")
n     = ap.opt("n")
hStart = ap.opt("h")
hEnd   = ap.opt("H")

# subcommand
command = ap.opt("c")
commandArgs = command.split(" ")
commandName = commandArgs.shift()

options =
  start : start
  highWaterMark: 1000000
options.end = end if end

worker = cp.spawn(commandName, commandArgs)
fwriter = fs.createWriteStream tmpfile, highWaterMark: 1024 * 1024 * 1024 -1
worker.stdout.pipe(fwriter)
writer = worker.stdin

# header
ok = true
if (hStart isnt false and hEnd isnt false)
  fd = fs.openSync(input, "r")
  buf = new Buffer(hEnd-hStart)
  fs.readSync(fd, buf, 0, hEnd-hStart, hStart)
  ok = writer.write(buf)
  fs.closeSync(fd)

# body

beginReadingBody = ->
  freader = fs.createReadStream input, options

  freader.on "data", (chunk)->
    ok = writer.write chunk
    if not ok
      freader.pause()
      writer.once "drain", -> freader.resume()

  freader.on "end", -> writer.end()

if ok
  beginReadingBody()
else
  writer.once "drain", beginReadingBody
