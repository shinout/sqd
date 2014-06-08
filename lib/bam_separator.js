(function() {
  var BGZF_MEAN_LEN, bgzfheader, fs, inflateRaw, n;

  bgzfheader = new Buffer("1f 8b 08 04 00 00 00 00 00 ff 06 00 42 43 02 00".split(" ").join(""), "hex");

  fs = require("fs");

  BGZF_MEAN_LEN = 655360;

  inflateRaw = require("zlib").inflateRaw;

  module.exports = function(bamfile, nProcess, cb) {
    var defBuf, delta, fails, fd, getHeader, infBuf, offset, size, splitBody, verboseInfo;
    verboseInfo = {
      bgzfheaders: {}
    };
    size = (fs.statSync(bamfile)).size;
    fails = [];
    fd = fs.openSync(bamfile, "r");

    /*
     * getting header
     */
    defBuf = new Buffer(0);
    infBuf = new Buffer(0);
    delta = 0;
    offset = 0;
    getHeader = function() {
      var bufToInflate, _defBuf;
      while (true) {
        if (defBuf.length < 26) {
          _defBuf = new Buffer(BGZF_MEAN_LEN);
          fs.readSync(fd, _defBuf, 0, BGZF_MEAN_LEN, offset);
          defBuf = Buffer.concat([defBuf, _defBuf]);
        }
        delta = defBuf.readUInt16LE(16) + 1;
        if (defBuf.length < delta) {
          _defBuf = new Buffer(BGZF_MEAN_LEN);
          fs.readSync(fd, _defBuf, 0, BGZF_MEAN_LEN, offset);
          defBuf = Buffer.concat([defBuf, _defBuf]);
          continue;
        }
        break;
      }
      offset += delta;
      bufToInflate = defBuf.slice(18, delta - 8);
      defBuf = defBuf.slice(delta);
      return inflateRaw(bufToInflate, function(e, _infBuf) {
        var cursor, header, headerLen, i, nRef, nameLen, _i;
        infBuf = Buffer.concat([infBuf, _infBuf]);
        headerLen = infBuf.readInt32LE(4);
        if (infBuf.length < headerLen + 12) {
          return getHeader();
        }
        header = infBuf.slice(8, headerLen + 8).toString("ascii");
        nRef = infBuf.readInt32LE(headerLen + 8);
        cursor = headerLen + 12;
        try {
          for (i = _i = 0; 0 <= nRef ? _i < nRef : _i > nRef; i = 0 <= nRef ? ++_i : --_i) {
            nameLen = infBuf.readInt32LE(cursor);
            cursor += nameLen + 8;
          }
        } catch (_error) {
          e = _error;
          return getHeader();
        }
        return splitBody();
      });
    };
    getHeader();

    /*
     * split body
     */
    return splitBody = function() {
      var b, buf, buflen, cursor, headerCandidate, i, interval, k, match, positions, start, _i, _j, _len;
      interval = Math.floor((size - offset) / nProcess);
      positions = [];
      buflen = Math.min(BGZF_MEAN_LEN, interval);
      for (k = _i = 0; 0 <= nProcess ? _i < nProcess : _i > nProcess; k = 0 <= nProcess ? ++_i : --_i) {
        start = interval * k + offset - 1;
        buf = new Buffer(buflen);
        fs.readSync(fd, buf, 0, buflen, start);
        cursor = -1;
        match = false;
        while (!(match || cursor + 16 > buf.length)) {
          cursor++;
          headerCandidate = buf.slice(cursor, cursor + 16);
          match = true;
          for (i = _j = 0, _len = bgzfheader.length; _j < _len; i = ++_j) {
            b = bgzfheader[i];
            if (b !== headerCandidate[i]) {
              match = false;
              break;
            }
          }
        }
        verboseInfo.bgzfheaders[k] = bgzfheader.toString("hex");
        if (match) {
          positions.push(start + cursor);
        } else {
          fails.push(k);
        }
      }
      fs.closeSync(fd);
      return cb(null, {
        header: [0, offset],
        positions: positions,
        size: size,
        interval: interval,
        fails: fails.length ? fails : null,
        verbose: verboseInfo
      });
    };
  };

  if (require.main === module) {
    n = Number(process.argv[3]);
    if (isNaN(n)) {
      n = 4;
    }
    console.log(JSON.stringify(module.exports(process.argv[2], n)));
  }

}).call(this);
