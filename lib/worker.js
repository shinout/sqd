(function() {
  var READ_HWM, WRITE_HWM, ap, cp, error, execute, fs, op, showStderr;

  fs = require("fs");

  cp = require("child_process");

  READ_HWM = 1000000;

  WRITE_HWM = 1024 * 1024 * 1024 - 1;

  error = function(streamName, exit) {
    return function(e) {
      console.error("[ERROR] " + streamName + " :");
      console.error(e.stack);
      if (exit) {
        return process.exit();
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
        return process.exit();
      }
    });
  };

  execute = function(options) {
    var beginReadingBody, buf, command, commandArgs, commandName, end, fd, fwriter, hEnd, hStart, input, n, ok, rOptions, start, tmpfile, worker, writer;
    input = options.input, tmpfile = options.tmpfile, command = options.command, start = options.start, end = options.end, n = options.n, hStart = options.hStart, hEnd = options.hEnd;
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
    fwriter = fs.createWriteStream(tmpfile, {
      highWaterMark: WRITE_HWM
    });
    worker.stdout.on("error", error("givenCommand" + n + ".stdout"));
    worker.stdin.on("error", error("givenCommand" + n + ".stdin"));
    showStderr(worker.stderr, "givenCommand" + n, true);
    worker.stdout.pipe(fwriter);
    writer = worker.stdin;
    if (typeof options.callback === "function") {
      fwriter.on("close", options.callback);
    }
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
    ap = require("argparser").files(0).arglen(2, 2).nums("n", "s", "e", "h", "H").vals("c").parse();
    op = {
      input: ap.arg(0),
      tmpfile: ap.arg(1),
      command: ap.opt("c"),
      start: ap.opt("s"),
      end: ap.opt("e"),
      n: ap.opt("n"),
      hStart: ap.opt("h"),
      hEnd: ap.opt("H")
    };
    execute(op);
  }

}).call(this);
