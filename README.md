SQD
==========
- SQD: Simple Query Divider
- SQD: SeQuential Distributor
- SQD: Super-Quick Disposer
- SQD: SQuiD-like multi-processor

executing unix commands with multi processes

installation
----------------
```bash
$ npm install -g sqd
```

usage
-------------
```bash
$ sqd -c command [--debug] [--exit] [-p #process] [-s separator_command] <input file> [output file]
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
- p: the number of processes
- debug: debug mode (showing time, temporary files)
- exit: exits when child processes emit an error or emit to stderr
- s: (see separator section)

separator
-------------
sqd requires a separator which separates a given input file into multiple chunks.
separator offers the way how sqd separates the file by JSON format.

the JSON keys are 

- positions: start positions of each chunks in the file

```js
"positions": [133, 271, 461, 631]
```
- header: [0, 133]
