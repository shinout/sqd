(function() {
  var READ_HWM, WRITE_HWM, cp, error, execute, fs, showStderr;

  fs = require("fs");

  cp = require("child_process");

  READ_HWM = 1e6;

  WRITE_HWM = 1e8;

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

  execute = function(options) {
    var beginReadingBody, buf, command, commandArgs, commandName, debug, end, fd, fwriter, hEnd, hStart, input, n, ok, rOptions, start, stop, tmpfile, worker, writer;
    input = options.input, tmpfile = options.tmpfile, command = options.command, start = options.start, end = options.end, n = options.n, hStart = options.hStart, hEnd = options.hEnd, debug = options.debug, stop = options.stop;
    commandArgs = command.split(" ");
    commandName = commandArgs.shift();
    rOptions = {
      start: start,
      highWaterMark: READ_HWM
    };
    if (end) {
      rOptions.end = end;
    }
    worker = cp.spawn(commandName, commandArgs);
    worker.stdout.on("error", error("givenCommand" + n + ".stdout", stop));
    worker.stdin.on("error", error("givenCommand" + n + ".stdin", stop));
    worker.on("error", error("givenCommand" + n, stop));
    showStderr(worker.stderr, "givenCommand" + n, stop);
    if (debug) {
      worker.on("exit", function(code, signal) {
        return console.error("process " + n + " onExit  code:" + code + ", " + signal);
      });
      worker.on("close", function(code, signal) {
        return console.error("process " + n + " onClose  code:" + code + ", " + signal);
      });
      worker.on("disconnect", function(code, signal) {
        return console.error("process " + n + " onDisconnect");
      });
    }
    if (tmpfile === "-") {
      fwriter = process.stdout;
      if (typeof options.callback === "function") {
        worker.stdout.on("end", options.callback);
      }
      worker.stdout.pipe(fwriter, {
        end: false
      });
    } else {
      fwriter = fs.createWriteStream(tmpfile, {
        highWaterMark: WRITE_HWM
      });
      if (typeof options.callback === "function") {
        fwriter.on("close", options.callback);
      }
      worker.stdout.pipe(fwriter);
    }
    writer = worker.stdin;
    ok = true;
    if ((hStart != null) && (hEnd != null) && hStart !== false && hEnd !== false) {
      fd = fs.openSync(input, "r");
      buf = new Buffer(hEnd - hStart);
      fs.readSync(fd, buf, 0, hEnd - hStart, hStart);
      ok = writer.write(buf);
      fs.closeSync(fd);
    }
    beginReadingBody = function() {
      var freader;
      freader = fs.createReadStream(input, rOptions);
      return freader.pipe(writer);
    };
    if (ok) {
      return beginReadingBody();
    } else {
      return writer.once("drain", beginReadingBody);
    }
  };

  module.exports = execute;

}).call(this);
