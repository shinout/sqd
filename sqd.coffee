fs = require "fs"
tmp = require "tmp"
cp = require "child_process"
worker = require "./worker.coffee"

# main operation
main = (options)->
  { input, output, command, separator, nProcess } = options

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
    tmp.setGracefulCleanup()
    for k in [0...nProcess]
      do (n = k)->
        tmp.tmpName (e, path)->
          tmpfiles[n] = path

          worker(
            input   : input
            tmpfile : path
            command : command
            start   : positions[n]
            end     : if n+1 isnt nProcess then positions[n+1]-1 else null
            n       : n
            hStart  : rule.header?[0]
            hEnd    : rule.header?[1]
            callback: ()->
              finishProcesses++
              if finishProcesses is nProcess
                console.timeEnd "time"
                cat = cp.spawn "cat", tmpfiles
                wstream = if output then fs.createWriteStream output, highWaterMark: 1024 * 1024 * 1024 -1 else process.stdout
                cat.stdout.pipe wstream
        )

  console.time "time"

showUsage = ->
  console.error """

  [USAGE]
  \tsqd -c command [-p #process] [-s separator_command] <input file> [output file]

  \tcommand:\t\t a unix command to be multiply executed from stream of the given input file
  \tseparator_command:\t command which gives a set of information of separation of the given input file.
  \t#process:\t\t the number of processes for parallel execution

"""

if require.main is module
  # argument definition
  try
    ap = require("argparser")
    .files(0)
    .arglen(1,2)
    .vals("c","command", "s", "sep")
    .defaults(p: 4)
    .parse()
  catch e
    console.error "[ERROR]: #{e.message}"
    showUsage()
    process.exit(1)

  # creating a separation rule
  separator = ap.opt("sep", "s")

  # subcommand
  command = ap.opt("command", "c")
  if not command
    console.error '[ERROR]: -c "<command>" is required'
    showUsage()
    process.exit(1)


  main(
    input     : ap.arg(0)
    output    : ap.arg(1)
    nProcess  : ap.opt("p")
    command   : command
    separator : ap.opt("sep", "s")
  )
