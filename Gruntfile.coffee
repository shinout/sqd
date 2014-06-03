module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON "package.json"
    coffee:
      compile:
        files:
          "lib/sqd.js": "src/sqd.coffee"
          "lib/worker.js": "src/worker.coffee"
          "lib/line_separator.js": "src/line_separator.coffee"
          "lib/bam_separator.js": "src/bam_separator.coffee"
          "lib/fastq_separator.js": "src/fastq_separator.coffee"

  grunt.loadNpmTasks "grunt-contrib-coffee"
  grunt.registerTask "default", ["coffee"]
