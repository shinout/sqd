(function() {
  var cp, error, fs, main, showStderr, showUsage, tmp;

  fs = require("fs");

  tmp = require("tmp");

  cp = require("child_process");

  main = function(options) {
    var command, count, debug, finishProcesses, input, interval, mem, nProcess, onClose, output, run, separationOpearator, separationRule, separator, separatorAsJS, sepcommand, startTime, stop, tmpfiles, worker, workerProcess;
    input = options.input, output = options.output, command = options.command, separator = options.separator, nProcess = options.nProcess, workerProcess = options.workerProcess, startTime = options.startTime, onClose = options.onClose, debug = options.debug, stop = options.stop, mem = options.mem;
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
      separationRule = separationOpearator(input, nProcess);
      process.nextTick(function() {
        return run(separationRule);
      });
    } else {
      sepcommand = [separator, input, nProcess].join(" ");
      cp.exec(sepCommand, function(e, stdout, stderr) {
        separationRule = JSON.parse(stdout);
        return run(separationRule);
      });
    }
    if (workerProcess) {
      worker = function(op) {
        var jsCommand;
        jsCommand = ["node", __dirname + "/worker.js", op.input, op.tmpfile, "-c", "'" + op.command + "'", "-s", op.start, "-n", op.n];
        if (op.end) {
          jsCommand.push("-e", op.end);
        }
        if (op.hStart != null) {
          jsCommand.push("-h", op.hStart);
        }
        if (op.hEnd != null) {
          jsCommand.push("-H", op.hEnd);
        }
        return cp.exec(jsCommand.join(" "), op.callback);
      };
    } else {
      worker = require("./worker.js");
    }
    tmpfiles = [];
    finishProcesses = 0;
    return run = function(rule) {
      var actualNProcess, k, positions, _i, _results;
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
      tmp.setGracefulCleanup();
      _results = [];
      for (k = _i = 0; 0 <= actualNProcess ? _i < actualNProcess : _i > actualNProcess; k = 0 <= actualNProcess ? ++_i : --_i) {
        _results.push((function(n) {
          return tmp.tmpName(function(e, path) {
            var _ref, _ref1;
            if (n !== 0) {
              tmpfiles.push(path);
              debug && console.error("using tmp file: " + path);
            }
            return worker({
              input: input,
              tmpfile: n === 0 ? (output ? output : "-") : path,
              command: command,
              start: positions[n],
              end: n + 1 !== actualNProcess ? positions[n + 1] - 1 : null,
              n: n,
              debug: debug,
              hStart: (_ref = rule.header) != null ? _ref[0] : void 0,
              hEnd: (_ref1 = rule.header) != null ? _ref1[1] : void 0,
              stop: stop,
              callback: function() {
                var cat, onExit, wstream;
                finishProcesses++;
                debug && console.error("%d process(es) finished: %dms", finishProcesses, new Date().getTime() - startTime);
                if (finishProcesses === actualNProcess) {
                  if (tmpfiles.length) {
                    cat = cp.spawn("cat", tmpfiles);
                    wstream = output ? fs.createWriteStream(output, {
                      flags: "a",
                      highWaterMark: 1e7
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
                  if (wstream === process.stdout) {
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
    return console.error("\n[USAGE]\n\tsqd -c command [--debug] [--exit] [-p #process] [-s separator_command] <input file> [output file]\n\n\tcommand:\t\t a unix command to be multiply executed from stream of the given input file\n\tseparator_command:\t command which gives a set of information of separation of the given input file.\n\t#process:\t\t the number of processes for parallel execution\n");
  };

  exports.run = function() {
    var ap, command, debug, e, separator, startTime;
    try {
      ap = require("argparser").files(0).arglen(1, 2).vals("c", "command", "s", "sep").nonvals("w", "debug", "d", "e", "exit", "mem").defaults({
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
      workerProcess: ap.opt("w"),
      startTime: startTime,
      debug: debug,
      stop: ap.opt("e", "exit"),
      mem: ap.opt("mem"),
      onClose: function() {
        return debug && console.error("time: %dms", new Date().getTime() - startTime);
      }
    });
  };

  if (require.main === module) {
    exports.run();
  }

}).call(this);
