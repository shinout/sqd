#!/usr/local/bin/coffee
# load modules
fs = require "fs"
tmp = require "tmp"
tmp.setGracefulCleanup()
cp = require "child_process"

# argument definition
ap = require("argparser")
.files(0)
.arglen(1,2)
.nums("p")
.vals("c","command", "s", "sep")
.parse()


# subcommand
command = ap.opt("command", "c")
commandArgs = command.split(" ")
commandName = commandArgs.shift()

# other arguments
nProcess = ap.opt("p") or 4
input = ap.arg(0)
output = ap.arg(1)

# creating a separation rule
separator = ap.opt("sep", "s")
if separator
  # if .coffee file is passed, execute it
  if separator.slice(-7) is ".coffee" and not separator.match(" ")
    separationOpearator = require separator
    separationRule = separationOpearator input, nProcess
    process.nextTick ->
      run separationRule

  # if command is passed, execute it and parse the result
  else
    sepcommand = [separator, input, nProcess].join(" ")
    cp.exec sepCommand, (e, stdout, stderr)->
      separationRule = JSON.parse(stdout)
      run separationRule
else
  # default separation rule: line separator
  lineSeparator = require(__dirname + "/line_separator.coffee") unless separator
  separationRule = lineSeparator input, nProcess
  process.nextTick ->
    run separationRule

# running commands as child processes
tmpfiles = []
finishProcesses = 0
run = (rule)->
  positions = rule.positions
  for k in [0...nProcess]
    do (p = k)->
      tmp.tmpName (e, path)->
        tmpfiles[p] = path

        coffeeCommand = [
          "coffee", __dirname+"/worker.coffee"
          input
          path
          "-c","'#{command}'"
          "-s", positions[p]
          "-n", p
        ]
        coffeeCommand.push("-e",positions[p+1]-1) unless p+1 is nProcess
        if rule.header
          coffeeCommand.push("-h", rule.header[0])
          coffeeCommand.push("-H", rule.header[1])

        cp.exec coffeeCommand.join(" "), (e, stdout, stderr)->
          # console.log stdout
          # console.error stderr
          finishProcesses++
          if finishProcesses is nProcess
            console.timeEnd "time"
            cat = cp.spawn "cat", tmpfiles
            wstream = if output then fs.createWriteStream output, highWaterMark: 1024 * 1024 * 1024 -1 else process.stdout
            cat.stdout.pipe wstream

console.time "time"
