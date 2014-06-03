(function() {
  var MEAN_FQ_SIZE, fs, n;

  fs = require("fs");

  MEAN_FQ_SIZE = 1000;

  module.exports = function(file, num) {
    var buf, fd, i, interval, k, key, length, line, lines, positions, prev, size, start, _i, _j, _k, _len;
    size = (fs.statSync(file)).size;
    interval = Math.floor(size / num);
    positions = [0];
    fd = fs.openSync(file, "r");
    for (k = _i = 1; 1 <= num ? _i < num : _i > num; k = 1 <= num ? ++_i : --_i) {
      prev = positions[k - 1] || -1;
      start = Math.max(interval * k, prev);
      while (start <= size) {
        buf = new Buffer(MEAN_FQ_SIZE);
        fs.readSync(fd, buf, 0, MEAN_FQ_SIZE, start);
        lines = buf.toString().split("\n");
        key = null;
        for (k = _j = 0, _len = lines.length; _j < _len; k = ++_j) {
          line = lines[k];
          if (line === "+") {
            console.log(line, k, lines.length);
            key = k + 1;
            break;
          }
        }
        if (lines[key]) {
          length = 0;
          for (i = _k = 0; 0 <= key ? _k <= key : _k >= key; i = 0 <= key ? ++_k : --_k) {
            length += lines[i].length + 1;
          }
          positions.push(start + length);
          break;
        }
        start += MEAN_FQ_SIZE;
      }
    }
    return {
      header: null,
      footer: null,
      positions: positions
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
