(function() {
  var BGZF_MEAN_LEN, bgzfheader, fs, inflateRaw, n;

  bgzfheader = new Buffer("1f 8b 08 04 00 00 00 00 00 ff 06 00 42 43 02 00".split(" ").join(""), "hex");

  fs = require("fs");

  require("coffee-script/register");

  BGZF_MEAN_LEN = 65536;

  inflateRaw = require("zlib").inflateRaw;

  require("termcolor").define;

  module.exports = function(bamfile, nProcess) {
    var b, buf, cdataLen, cursor, fd, headerBuf, headerCandidate, i, interval, k, match, offset, positions, size, start, _i, _j, _len;
    size = (fs.statSync(bamfile)).size;
    fd = fs.openSync(bamfile, "r");
    headerBuf = new Buffer(BGZF_MEAN_LEN);
    fs.readSync(fd, headerBuf, 0, BGZF_MEAN_LEN, 0);
    cdataLen = headerBuf.readUInt16LE(16) - 25;
    offset = cdataLen + 26;
    headerBuf = headerBuf.slice(0, offset);
    interval = Math.floor((size - offset) / nProcess);
    positions = [];
    for (k = _i = 0; 0 <= nProcess ? _i < nProcess : _i > nProcess; k = 0 <= nProcess ? ++_i : --_i) {
      start = interval * k + offset - 1;
      buf = new Buffer(BGZF_MEAN_LEN);
      fs.read(fd, buf, 0, BGZF_MEAN_LEN, start);
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
      buf.cursor + 26;
      positions.push(start + cursor);
    }
    fs.closeSync(fd);
    return {
      header: [0, offset],
      positions: positions,
      size: size,
      interval: interval
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
