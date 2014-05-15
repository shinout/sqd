(function() {
  var READ_HWM, WRITE_HWM, ap, cp, error, execute, fs, op, showStderr;

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
    showStderr(worker.stderr, "givenCommand" + n, stop);
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
      freader.on("data", function(chunk) {
        var writable;
        writable = writer.write(chunk);
        if (!writable) {
          freader.pause();
          return writer.once("drain", function() {
            return freader.resume();
          });
        }
      });
      return freader.on("end", function() {
        return writer.end();
      });
    };
    if (ok) {
      return beginReadingBody();
    } else {
      return writer.once("drain", beginReadingBody);
    }
  };

  module.exports = execute;

  if (require.main === module) {
    ap = require("argparser").files(0).arglen(2, 2).nums("n", "s", "e", "h", "H").vals("c").nonvals("debug", "d").parse();
    op = {
      input: ap.arg(0),
      tmpfile: ap.arg(1),
      command: ap.opt("c"),
      start: ap.opt("s"),
      end: ap.opt("e"),
      n: ap.opt("n"),
      hStart: ap.opt("h"),
      hEnd: ap.opt("H"),
      debug: ap.opt("d", "debug"),
      stop: ap.opt("stop")
    };
    execute(op);
  }

}).call(this);
