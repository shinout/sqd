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
$ sqd -c command [-p #process] [-s separator_command] <input file> [output file]
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
