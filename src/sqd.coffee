fs = require "fs"
tmp = require "tmp"
cp = require "child_process"
worker = require "./worker.js"

# main operation
main = (options)->
  { input, output, command, separator, nProcess, startTime, onClose, debug, stop, mem, rhwm, whwm, reduce } = options
  if mem
    count = 0
    interval = setInterval( ->
      memory = process.memoryUsage()
      console.error "[memory]", ++count, memory.rss, memory.heapTotal, memory.heapUsed
    , 1000)
  else
    interval = null

  separator = "line" if not separator
  # if .js file is passed, execute it
  separatorAsJS = "#{__dirname}/#{separator}_separator.js"
  if fs.existsSync separatorAsJS
    separationOpearator = require separatorAsJS
    separationOpearator input, nProcess, (err, separationRule)->
      if err
        throw err
      else
        process.nextTick -> run separationRule

  # if command is passed, execute it and parse the result
  else
    sepcommand = [separator, input, nProcess].join(" ")
    cp.exec sepCommand, (e, stdout, stderr)->
      separationRule = JSON.parse(stdout)
      run separationRule

  # running commands as child processes
  tmpfiles = []
  finishProcesses = 0

  run = (rule)->
    if debug
      console.error "after separator: %dms", new Date().getTime() - startTime
      console.error "[separation rules]"
      console.error JSON.stringify rule

    positions = rule.positions
    throw new Error "invalid separator: no positions" unless positions.length
    actualNProcess = positions.length
    debug and console.error "separator separated the file into #{actualNProcess} while p is #{nProcess}"

    # if reduce, spawning a child process as a reducer
    reducer = null
    finalWstream = null
    if reduce
      reducer = cp.spawn
      commandArgs = command.split(" ")
      commandName = commandArgs.shift()
      env = {}
      env[k] = v for k, v of process.env
      for k,v of options when typeof v isnt "function"
        if typeof v is "boolean"
          env["sqd_" + k] = if v then "1" else "0"
        else
          env["sqd_" + k] = v
      env.sqd_reduce = "1"
      reducer = cp.spawn(commandName, commandArgs, env: env)
      finalWstream = if output then fs.createWriteStream output, highWaterMark: 1e5 else process.stdout
      reducer.stdout.pipe finalWstream
      debug and console.error "spawning a child process as a reducer"

    tmp.setGracefulCleanup()
    for k in [0...actualNProcess]
      do (n = k)->
        tmp.tmpName (e, path)->
          if n isnt 0
            tmpfiles.push path
            debug and console.error "using tmp file: #{path}"

          worker(
            input   : input
            tmpfile : if n is 0 then (if reducer then reducer.stdin else if output then output else process.stdout) else path # write to output file when n is 0
            command : command
            start   : positions[n]
            end     : if n+1 isnt actualNProcess then positions[n+1]-1 else null
            n       : n
            debug   : debug
            hStart  : rule.header?[0]
            hEnd    : rule.header?[1]
            rhwm    : rhwm
            whwm    : whwm
            stop    : stop
            callback: ()->
              finishProcesses++
              debug and console.error "%d process(es) finished: %dms", finishProcesses, new Date().getTime() - startTime
              if finishProcesses is actualNProcess
                if tmpfiles.length
                  cat = cp.spawn "cat", tmpfiles
                  wstream = if reducer then reducer.stdin else if output then fs.createWriteStream output, flags: "a", highWaterMark: 1e5 else process.stdout

                  showStderr cat.stderr, "cat"
                  wstream.on "error", (e)-> error "outputStream", stop
                  cat.stdout.on "error", (e)-> error "cat.stdout", stop
                  cat.stdin.on "error", (e)-> error "cat.stdin", stop
                  cat.on "error", (e)-> error "cat", stop
                  cat.stdout.pipe wstream

                  onExit = ->
                    unlinkCounter = 1
                    cb = ->
                      if ++unlinkCounter is actualNProcess
                        clearInterval interval if interval
                        onClose()
                    fs.unlink tmpfile, cb for tmpfile in tmpfiles

                  if debug
                    cat.on "exit", (code, signal)->
                      console.error "cat onExit  code:#{code}, #{signal}"
                    cat.on "close", (code, signal)->
                      console.error "cat onClose  code:#{code}, #{signal}"
                    cat.on "disconnect", (code, signal)->
                      console.error "cat Disconnect"

                else
                  onClose() if typeof onClose is "function"

                if finalWstream
                  finalWstream.on "close", onExit
                else if wstream is process.stdout
                  cat.on "close",  onExit
                else
                  wstream.on "close",  onExit
        )

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


showUsage = ->
  console.error """

  [USAGE]
  \tsqd -c command [--debug] [--exit] [-p #process] [-s separator_command] [--reduce] <input file> [output file]

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
    .nonvals("w", "debug", "d", "e", "exit", "mem", "reduce")
    .nums("rhwm", "whwm")
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
  debug = ap.opt("debug", "d")

  main(
    input     : ap.arg(0)
    output    : ap.arg(1)
    nProcess  : ap.opt("p")
    command   : command
    separator : ap.opt("sep", "s")
    startTime : startTime
    debug     : debug
    stop      : ap.opt("e", "exit")
    mem       : ap.opt("mem")
    whwm      : ap.opt("whwm")
    rhwm      : ap.opt("rhwm")
    reduce    : ap.opt("reduce")
    onClose   : ->
      debug and console.error "time: %dms", new Date().getTime() - startTime
  )

exports.run() if require.main is module
