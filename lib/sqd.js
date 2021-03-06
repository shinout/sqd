(function() {
  var cp, error, fs, main, showStderr, showUsage, tmp, worker;

  fs = require("fs");

  tmp = require("tmp");

  cp = require("child_process");

  worker = require("./worker.js");

  main = function(options) {
    var command, count, debug, finishProcesses, input, interval, mem, nProcess, onClose, output, reduce, rhwm, run, separationOpearator, separator, separatorAsJS, sepcommand, startTime, stop, tmpfiles, whwm;
    input = options.input, output = options.output, command = options.command, separator = options.separator, nProcess = options.nProcess, startTime = options.startTime, onClose = options.onClose, debug = options.debug, stop = options.stop, mem = options.mem, rhwm = options.rhwm, whwm = options.whwm, reduce = options.reduce;
    if (mem) {
      count = 0;
      interval = setInterval(function() {
        var memory;
        memory = process.memoryUsage();
        return console.error("[memory]", ++count, memory.rss, memory.heapTotal, memory.heapUsed);
      }, 1000);
    } else {
      interval = null;
    }
    if (!separator) {
      separator = "line";
    }
    separatorAsJS = "" + __dirname + "/" + separator + "_separator.js";
    if (fs.existsSync(separatorAsJS)) {
      separationOpearator = require(separatorAsJS);
      separationOpearator(input, nProcess, function(err, separationRule) {
        if (err) {
          throw err;
        } else {
          return process.nextTick(function() {
            return run(separationRule);
          });
        }
      });
    } else {
      sepcommand = [separator, input, nProcess].join(" ");
      cp.exec(sepCommand, function(e, stdout, stderr) {
        var separationRule;
        separationRule = JSON.parse(stdout);
        return run(separationRule);
      });
    }
    tmpfiles = [];
    finishProcesses = 0;
    return run = function(rule) {
      var actualNProcess, commandArgs, commandName, env, finalWstream, k, positions, reducer, v, _i, _ref, _results;
      if (debug) {
        console.error("after separator: %dms", new Date().getTime() - startTime);
        console.error("[separation rules]");
        console.error(JSON.stringify(rule));
      }
      positions = rule.positions;
      if (!positions.length) {
        throw new Error("invalid separator: no positions");
      }
      actualNProcess = positions.length;
      debug && console.error("separator separated the file into " + actualNProcess + " while p is " + nProcess);
      reducer = null;
      finalWstream = null;
      if (reduce) {
        reducer = cp.spawn;
        commandArgs = command.split(" ");
        commandName = commandArgs.shift();
        env = {};
        _ref = process.env;
        for (k in _ref) {
          v = _ref[k];
          env[k] = v;
        }
        for (k in options) {
          v = options[k];
          if (typeof v !== "function") {
            if (typeof v === "boolean") {
              env["sqd_" + k] = v ? "1" : "0";
            } else {
              env["sqd_" + k] = v;
            }
          }
        }
        env.sqd_reduce = "1";
        reducer = cp.spawn(commandName, commandArgs, {
          env: env
        });
        finalWstream = output ? fs.createWriteStream(output, {
          highWaterMark: 1e5
        }) : process.stdout;
        reducer.stdout.pipe(finalWstream);
        debug && console.error("spawning a child process as a reducer");
      }
      tmp.setGracefulCleanup();
      _results = [];
      for (k = _i = 0; 0 <= actualNProcess ? _i < actualNProcess : _i > actualNProcess; k = 0 <= actualNProcess ? ++_i : --_i) {
        _results.push((function(n) {
          return tmp.tmpName(function(e, path) {
            var _ref1, _ref2;
            if (n !== 0) {
              tmpfiles.push(path);
              debug && console.error("using tmp file: " + path);
            }
            return worker({
              input: input,
              tmpfile: n === 0 ? (reducer ? reducer.stdin : output ? output : process.stdout) : path,
              command: command,
              start: positions[n],
              end: n + 1 !== actualNProcess ? positions[n + 1] - 1 : null,
              n: n,
              debug: debug,
              hStart: (_ref1 = rule.header) != null ? _ref1[0] : void 0,
              hEnd: (_ref2 = rule.header) != null ? _ref2[1] : void 0,
              rhwm: rhwm,
              whwm: whwm,
              stop: stop,
              callback: function() {
                var cat, onExit, wstream;
                finishProcesses++;
                debug && console.error("%d process(es) finished: %dms", finishProcesses, new Date().getTime() - startTime);
                if (finishProcesses === actualNProcess) {
                  if (tmpfiles.length) {
                    cat = cp.spawn("cat", tmpfiles);
                    wstream = reducer ? reducer.stdin : output ? fs.createWriteStream(output, {
                      flags: "a",
                      highWaterMark: 1e5
                    }) : process.stdout;
                    showStderr(cat.stderr, "cat");
                    wstream.on("error", function(e) {
                      return error("outputStream", stop);
                    });
                    cat.stdout.on("error", function(e) {
                      return error("cat.stdout", stop);
                    });
                    cat.stdin.on("error", function(e) {
                      return error("cat.stdin", stop);
                    });
                    cat.on("error", function(e) {
                      return error("cat", stop);
                    });
                    cat.stdout.pipe(wstream);
                    onExit = function() {
                      var cb, tmpfile, unlinkCounter, _j, _len, _results1;
                      unlinkCounter = 1;
                      cb = function() {
                        if (++unlinkCounter === actualNProcess) {
                          if (interval) {
                            clearInterval(interval);
                          }
                          return onClose();
                        }
                      };
                      _results1 = [];
                      for (_j = 0, _len = tmpfiles.length; _j < _len; _j++) {
                        tmpfile = tmpfiles[_j];
                        _results1.push(fs.unlink(tmpfile, cb));
                      }
                      return _results1;
                    };
                    if (debug) {
                      cat.on("exit", function(code, signal) {
                        return console.error("cat onExit  code:" + code + ", " + signal);
                      });
                      cat.on("close", function(code, signal) {
                        return console.error("cat onClose  code:" + code + ", " + signal);
                      });
                      cat.on("disconnect", function(code, signal) {
                        return console.error("cat Disconnect");
                      });
                    }
                  } else {
                    if (typeof onClose === "function") {
                      onClose();
                    }
                  }
                  if (finalWstream) {
                    return finalWstream.on("close", onExit);
                  } else if (wstream === process.stdout) {
                    return cat.on("close", onExit);
                  } else {
                    return wstream.on("close", onExit);
                  }
                }
              }
            });
          });
        })(k));
      }
      return _results;
    };
  };

  error = function(streamName, exit) {
    return function(e) {
      console.error("[ERROR] " + streamName + " :");
      console.error(e.stack);
      if (exit) {
        return process.exit(1);
      }
    };
  };

  showStderr = function(stderr, name, exit) {
    if (stderr === process.stderr) {
      return;
    }
    stderr.setEncoding("utf-8");
    return stderr.on("data", function(data) {
      console.error("STDERR in " + name + ":");
      console.error(data);
      if (exit) {
        return process.exit(1);
      }
    });
  };

  showUsage = function() {
    return console.error("\n[USAGE]\n\tsqd -c command [--debug] [--exit] [-p #process] [-s separator_command] [--reduce] <input file> [output file]\n\n\tcommand:\t\t a unix command to be multiply executed from stream of the given input file\n\tseparator_command:\t command which gives a set of information of separation of the given input file.\n\t#process:\t\t the number of processes for parallel execution\n");
  };

  exports.run = function() {
    var ap, command, debug, e, separator, startTime;
    try {
      ap = require("argparser").files(0).arglen(1, 2).vals("c", "command", "s", "sep").nonvals("w", "debug", "d", "e", "exit", "mem", "reduce").nums("rhwm", "whwm").defaults({
        p: 4
      }).parse();
    } catch (_error) {
      e = _error;
      console.error("[ERROR]: " + e.message);
      showUsage();
      process.exit(1);
    }
    separator = ap.opt("sep", "s");
    command = ap.opt("command", "c");
    if (!command) {
      console.error('[ERROR]: -c "<command>" is required');
      showUsage();
      process.exit(1);
    }
    startTime = new Date().getTime();
    debug = ap.opt("debug", "d");
    return main({
      input: ap.arg(0),
      output: ap.arg(1),
      nProcess: ap.opt("p"),
      command: command,
      separator: ap.opt("sep", "s"),
      startTime: startTime,
      debug: debug,
      stop: ap.opt("e", "exit"),
      mem: ap.opt("mem"),
      whwm: ap.opt("whwm"),
      rhwm: ap.opt("rhwm"),
      reduce: ap.opt("reduce"),
      onClose: function() {
        return debug && console.error("time: %dms", new Date().getTime() - startTime);
      }
    });
  };

  if (require.main === module) {
    exports.run();
  }

}).call(this);
