startTime = new Date().getTime()
console.error "after separator: %dms", new Date().getTime() - startTime
reader = require("bamreader").create(process.stdin)
count = 0
prevTime = startTime
total = 0
n = 0
reader.on "bam", (bamdata)->
  count++
  if count % 1000 is 0
    if count is 1000
      console.log "iteration%d: %dms", count, new Date().getTime() - startTime
    else
      time = new Date().getTime() - prevTime
      #console.log "iteration%d: %dms", count, time
      total += time
      n++
    prevTime = new Date().getTime()

  #console.log bamdata.seq if not bamdata.seq.match("N") and bamdata.flags.unmapped
  
reader.on "end", (bamdata)->
  console.log Math.floor(total*100/n)/100
