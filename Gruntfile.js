module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-benchmark');

  grunt.initConfig({
    benchmark: {
      options: {
        displayResults: true
      },
      timeseriesBench: {
        src: ['tmp/**/*_bench.js'],
        dest: 'tmp/benchmark.csv'
      }
    }

  });

  grunt.registerTask('bench', [
    'benchmark'
  ]);
};
