(function() {
  var cp, error, fs, main, showStderr, showUsage, tmp;

  fs = require("fs");

  tmp = require("tmp");

  cp = require("child_process");

  main = function(options) {
    var command, debug, finishProcesses, input, nProcess, onClose, output, run, separationOpearator, separationRule, separator, separatorAsJS, sepcommand, startTime, tmpfiles, worker, workerProcess;
    input = options.input, output = options.output, command = options.command, separator = options.separator, nProcess = options.nProcess, workerProcess = options.workerProcess, startTime = options.startTime, onClose = options.onClose, debug = options.debug;
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
      var k, positions, _i, _results;
      debug && console.error("after separator: %dms", new Date().getTime() - startTime);
      positions = rule.positions;
      tmp.setGracefulCleanup();
      _results = [];
      for (k = _i = 0; 0 <= nProcess ? _i < nProcess : _i > nProcess; k = 0 <= nProcess ? ++_i : --_i) {
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
              end: n + 1 !== nProcess ? positions[n + 1] - 1 : null,
              n: n,
              hStart: (_ref = rule.header) != null ? _ref[0] : void 0,
              hEnd: (_ref1 = rule.header) != null ? _ref1[1] : void 0,
              callback: function() {
                var cat, wstream;
                finishProcesses++;
                debug && console.error("%d process(es) finished: %dms", finishProcesses, new Date().getTime() - startTime);
                if (finishProcesses === nProcess) {
                  cat = cp.spawn("cat", tmpfiles);
                  wstream = output ? fs.createWriteStream(output, {
                    flags: "a",
                    highWaterMark: 1024 * 1024 * 1024 - 1
                  }) : process.stdout;
                  showStderr(cat.stderr, "cat");
                  wstream.on("error", function(e) {
                    return error("outputStream");
                  });
                  cat.stdout.on("error", function(e) {
                    return error("cat.stdout");
                  });
                  cat.stdin.on("error", function(e) {
                    return error("cat.stdin");
                  });
                  cat.stdout.pipe(wstream);
                  return wstream.on("close", function() {
                    var cb, tmpfile, unlinkCounter, _j, _len, _results1;
                    unlinkCounter = 0;
                    cb = function() {
                      if (++unlinkCounter === nProcess) {
                        return onClose();
                      }
                    };
                    _results1 = [];
                    for (_j = 0, _len = tmpfiles.length; _j < _len; _j++) {
                      tmpfile = tmpfiles[_j];
                      _results1.push(fs.unlink(tmpfile, cb));
                    }
                    return _results1;
                  });
                }
              }
            });
          });
        })(k));
      }
      return _results;
    };
  };

  error = function(streamName, end) {
    return function(e) {
      console.error("[ERROR] " + streamName + " :");
      console.error(e.stack);
      if (end) {
        return process.exit();
      }
    };
  };

  showStderr = function(stderr, name) {
    if (stderr === process.stderr) {
      return;
    }
    stderr.setEncoding("utf-8");
    return stderr.on("data", function(data) {
      console.error("STDERR in " + name + ":");
      return console.error(data);
    });
  };

  showUsage = function() {
    return console.error("\n[USAGE]\n\tsqd -c command [-p #process] [-s separator_command] <input file> [output file]\n\n\tcommand:\t\t a unix command to be multiply executed from stream of the given input file\n\tseparator_command:\t command which gives a set of information of separation of the given input file.\n\t#process:\t\t the number of processes for parallel execution\n");
  };

  exports.run = function() {
    var ap, command, e, separator, startTime;
    try {
      ap = require("argparser").files(0).arglen(1, 2).vals("c", "command", "s", "sep").nonvals("w", "debug", "d").defaults({
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
    return main({
      input: ap.arg(0),
      output: ap.arg(1),
      nProcess: ap.opt("p"),
      command: command,
      separator: ap.opt("sep", "s"),
      workerProcess: ap.opt("w"),
      startTime: startTime,
      debug: ap.opt("debug", "d"),
      onClose: function() {
        return ap.opt("debug", "d") && console.error("time: %dms", new Date().getTime() - startTime);
      }
    });
  };

  if (require.main === module) {
    exports.run();
  }

}).call(this);
