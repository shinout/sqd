fs = require "fs"
tmp = require "tmp"
cp = require "child_process"

# main operation
main = (options)->
  { input, output, command, separator, nProcess, workerProcess, startTime, onClose, debug } = options

  separator = "line" if not separator
  # if .js file is passed, execute it
  separatorAsJS = "#{__dirname}/#{separator}_separator.js"
  if fs.existsSync separatorAsJS
    separationOpearator = require separatorAsJS
    separationRule = separationOpearator input, nProcess
    process.nextTick ->
      run separationRule

  # if command is passed, execute it and parse the result
  else
    sepcommand = [separator, input, nProcess].join(" ")
    cp.exec sepCommand, (e, stdout, stderr)->
      separationRule = JSON.parse(stdout)
      run separationRule

  if workerProcess
    worker = (op)->
      jsCommand = [
        "node", __dirname+"/worker.js"
        op.input
        op.tmpfile
        "-c","'#{op.command}'"
        "-s", op.start
        "-n", op.n
      ]
      jsCommand.push("-e",op.end) if op.end
      jsCommand.push("-h", op.hStart) if op.hStart?
      jsCommand.push("-H", op.hEnd) if op.hEnd?

      cp.exec jsCommand.join(" "), op.callback
  else
    worker = require "./worker.js"

  # running commands as child processes
  tmpfiles = []
  finishProcesses = 0

  run = (rule)->
    debug and console.error "after separator: %dms", new Date().getTime() - startTime
    positions = rule.positions
    tmp.setGracefulCleanup()
    for k in [0...nProcess]
      do (n = k)->
        tmp.tmpName (e, path)->
          tmpfiles.push path if n isnt 0

          worker(
            input   : input
            tmpfile : if n is 0 then (if output then output else "-") else path # write to output file when n is 0
            command : command
            start   : positions[n]
            end     : if n+1 isnt nProcess then positions[n+1]-1 else null
            n       : n
            hStart  : rule.header?[0]
            hEnd    : rule.header?[1]
            callback: ()->
              finishProcesses++
              debug and console.error "%d process(es) finished: %dms", finishProcesses, new Date().getTime() - startTime
              if finishProcesses is nProcess
                cat = cp.spawn "cat", tmpfiles
                wstream = if output then fs.createWriteStream output, flags: "a", highWaterMark: 1024 * 1024 * 1024 -1 else process.stdout

                showStderr cat.stderr, "cat"
                wstream.on "error", (e)-> error "outputStream"
                cat.stdout.on "error", (e)-> error "cat.stdout"
                cat.stdin.on "error", (e)-> error "cat.stdin"

                cat.stdout.pipe wstream

                wstream.on "close", ->
                  unlinkCounter = 0
                  cb = -> onClose() if ++unlinkCounter is nProcess
                  fs.unlink tmpfile, cb for tmpfile in tmpfiles
        )

error = (streamName, end)->
  return (e)->
    console.error "[ERROR] #{streamName} :"
    console.error e.stack
    process.exit() if end

showStderr = (stderr, name)->
  return if stderr is process.stderr
  stderr.setEncoding "utf-8"
  stderr.on "data", (data)->
    console.error "STDERR in #{name}:"
    console.error data


showUsage = ->
  console.error """

  [USAGE]
  \tsqd -c command [-p #process] [-s separator_command] <input file> [output file]

  \tcommand:\t\t a unix command to be multiply executed from stream of the given input file
  \tseparator_command:\t command which gives a set of information of separation of the given input file.
  \t#process:\t\t the number of processes for parallel execution

"""

exports.run = ->
  # argument definition
  try
    ap = require("argparser")
    .files(0)
    .arglen(1,2)
    .vals("c","command", "s", "sep")
    .nonvals("w", "debug", "d")
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
  
  startTime = new Date().getTime()

  main(
    input         : ap.arg(0)
    output        : ap.arg(1)
    nProcess      : ap.opt("p")
    command       : command
    separator     : ap.opt("sep", "s")
    workerProcess : ap.opt("w")
    startTime     : startTime
    debug         : ap.opt("debug", "d")
    onClose       : ->
      ap.opt("debug", "d") and console.error "time: %dms", new Date().getTime() - startTime
  )

exports.run() if require.main is module
