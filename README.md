SQD
==========
executing unix commands with multi processes

installation
----------------
```bash
$ npm install -g sqd
```

usage
-------------
```bash
$ sqd -c command [--debug] [--exit] [-p nProcess] [-s separator_command] <input file> [output file]
```

grep with 8 processes

```bash
sqd -c "grep -e something" -p 8 input.txt
```
results are on STDOUT.


sed with 4 processes (default), results to output.txt

```bash
sqd -c "sed -e y/ATCG/atcg/" input.txt output.txt
```

with separator option, we can also handle binary files
```bash
sqd -c "samtools view -" -s bam input.bam
```

options
-------------
- -p: the number of processes
- --debug: debug mode (showing time, temporary files)
- --exit: exits when child processes emit an error or emit to stderr
- -s: (see separator section)

separator
-------------
sqd requires a separator which separates a given input file into multiple chunks.
separator offers the way how sqd separates the file by JSON format.

the JSON keys are 

- positions: start positions of each chunks in the file

```js
"positions": [133, 271, 461, 631]
```

- header: range of the header section of the file, null when there is no header section

```js
"header": [0, 133]
```

- size: file size (optional)

```js
"size": 34503
```
