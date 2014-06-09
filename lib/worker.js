(function() {
  var READ_HWM, WRITE_HWM, cp, deepCopy, error, execute, fs, showStderr;

  fs = require("fs");

  cp = require("child_process");

  READ_HWM = 1e5;

  WRITE_HWM = 1e6;

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
    var beginReadingBody, buf, command, commandArgs, commandName, debug, end, env, fd, fwriter, hEnd, hStart, highWaterMark_READ, highWaterMark_WRITE, input, k, n, ok, rOptions, rhwm, start, stop, tmpfile, v, whwm, worker, writer;
    input = options.input, tmpfile = options.tmpfile, command = options.command, start = options.start, end = options.end, n = options.n, hStart = options.hStart, hEnd = options.hEnd, debug = options.debug, stop = options.stop, rhwm = options.rhwm, whwm = options.whwm;
    commandArgs = command.split(" ");
    commandName = commandArgs.shift();
    highWaterMark_READ = rhwm ? Math.pow(10, rhwm) : READ_HWM;
    rOptions = {
      start: start,
      highWaterMark: highWaterMark_READ
    };
    if (end) {
      rOptions.end = end;
    }
    env = deepCopy(process.env);
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
    env.sqd_map = "1";
    worker = cp.spawn(commandName, commandArgs, {
      env: env
    });
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
    if (tmpfile.writable) {
      fwriter = tmpfile;
      if (typeof options.callback === "function") {
        worker.stdout.on("end", options.callback);
      }
      worker.stdout.pipe(fwriter, {
        end: false
      });
    } else {
      highWaterMark_WRITE = whwm ? Math.pow(10, whwm) : WRITE_HWM;
      fwriter = fs.createWriteStream(tmpfile, {
        highWaterMark: highWaterMark_WRITE
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

  deepCopy = function(val) {
    var attr, ret, v;
    if (Array.isArray(val)) {
      return val.map(deepCopy);
    }
    if (typeof val !== "object" || val === null || val === void 0) {
      return val;
    }
    ret = {};
    for (attr in val) {
      v = val[attr];
      if (val.hasOwnProperty(attr)) {
        ret[attr] = deepCopy(v);
      }
    }
    return ret;
  };

  module.exports = execute;

}).call(this);
