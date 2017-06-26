module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-benchmark');

  grunt.initConfig({

    clean: {
      dist: {
        src: ["dist"]
      },
      test: {
        src: ["dist/test"]
      },
      tmp: {
        src: ["tmp"]
      }
    },

    copy: {
      src_to_dist: {
        cwd: 'src',
        expand: true,
        src: [
          '**/*',
          '!datasource-zabbix/*.js',
          '!panel-triggers/*.js',
          '!components/*.js',
          '!module.js',
          '!**/*.scss'
        ],
        dest: 'dist/'
      },
      pluginDef: {
        expand: true,
        src: ['plugin.json'],
        dest: 'dist/',
      }
    },

    watch: {
      rebuild_all: {
        files: ['src/**/*', 'plugin.json'],
        tasks: ['watchTask'],
        options: {spawn: false}
      },
    },

    babel: {
      options: {
        presets: ["es2015"]
      },
      dist: {
        options: {
          sourceMap: true,
          plugins: ['transform-es2015-modules-systemjs', "transform-es2015-for-of"]
        },
        files: [{
          cwd: 'src',
          expand: true,
          src: [
            'datasource-zabbix/*.js',
            'panel-triggers/*.js',
            'components/*.js',
            'module.js',
          ],
          dest: 'dist/'
        }]
      },
      distTestNoSystemJs: {
        files: [{
          cwd: 'src',
          expand: true,
          src: ['**/*.js'],
          dest: 'dist/test'
        }]
      },
      distTestsSpecsNoSystemJs: {
        files: [{
          expand: true,
          cwd: 'specs',
          src: ['**/*.js'],
          dest: 'dist/test/specs'
        }]
      },
      distBenchmarks: {
        files: [{
          cwd: 'src/datasource-zabbix/benchmarks',
          expand: true,
          src: ['**/*.js'],
          dest: 'dist/test/benchmarks'
        }]
      },
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: [
          'dist/test/datasource-zabbix/specs/test-main.js',
          'dist/test/datasource-zabbix/specs/*_specs.js'
        ]
      }
    },

    sass: {
      options: {
        sourceMap: true
      },
      dist: {
        files: {
          'dist/css/grafana-zabbix.light.css': 'src/sass/grafana-zabbix.light.scss',
          'dist/css/grafana-zabbix.dark.css': 'src/sass/grafana-zabbix.dark.scss'
        }
      }
    },

    jshint: {
      source: {
        files: {
          src: ['src/**/*.js'],
        }
      },
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish'),
        ignores: [
          'node_modules/*',
          'dist/*',
          'src/datasource-zabbix/benchmarks/*'
        ]
      }
    },

    jscs: {
      src: ['src/**/*.js'],
      options: {
        config: ".jscs.json",
      },
    },

    benchmark: {
      options: {
        displayResults: true
      },
      timeseriesBench: {
        src: ['dist/test/datasource-zabbix/benchmarks/*.js'],
        dest: 'tmp/benchmark.csv'
      }
    }

  });

  grunt.registerTask('default', [
    'clean:dist',
    'sass',
    'copy:src_to_dist',
    'copy:pluginDef',
    'jshint',
    'jscs',
    'babel',
    'mochaTest'
  ]);

  grunt.registerTask('watchTask', [
    'clean:dist',
    'sass',
    'copy:src_to_dist',
    'copy:pluginDef',
    'babel',
    'jshint',
    'jscs'
  ]);

  grunt.registerTask('bench', [
    'clean:test',
    'clean:tmp',
    'babel:distTestNoSystemJs',
    'babel:distTestsSpecsNoSystemJs',
    'benchmark'
  ]);
};
