(function() {
  var MEAN_LINE_LEN, fs, n;

  fs = require("fs");

  MEAN_LINE_LEN = 1024;

  module.exports = function(file, num, cb) {
    var buf, fd, interval, k, lines, positions, prev, size, start, _i;
    size = (fs.statSync(file)).size;
    interval = Math.floor(size / num);
    positions = [0];
    fd = fs.openSync(file, "r");
    for (k = _i = 1; 1 <= num ? _i < num : _i > num; k = 1 <= num ? ++_i : --_i) {
      prev = positions[k - 1] || -1;
      start = Math.max(interval * k, prev);
      while (start <= size) {
        buf = new Buffer(MEAN_LINE_LEN);
        fs.readSync(fd, buf, 0, MEAN_LINE_LEN, start);
        lines = buf.toString().split("\n");
        if (lines.length > 1) {
          positions.push(start + lines[0].length + 1);
          break;
        }
        start += MEAN_LINE_LEN;
      }
    }
    return cb(null, {
      header: null,
      footer: null,
      positions: positions
    });
  };

  if (require.main === module) {
    n = Number(process.argv[3]);
    if (isNaN(n)) {
      n = 4;
    }
    console.log(JSON.stringify(module.exports(process.argv[2], n)));
  }

}).call(this);
