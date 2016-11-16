module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.initConfig({

    clean: ["dist"],

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
        presets:  ["es2015"]
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
      }
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
          'dist/panel-triggers/css/panel_triggers.css' : 'src/panel-triggers/sass/panel_triggers.scss',
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
        ]
      }
    },

    jscs: {
      src: ['src/**/*.js'],
      options: {
        config: ".jscs.json",
      },
    }

  });

  grunt.registerTask('default', [
    'clean',
    'copy:src_to_dist',
    'copy:pluginDef',
    'jshint',
    'jscs',
    'sass',
    'babel',
    'mochaTest'
  ]);

  grunt.registerTask('watchTask', [
    'clean',
    'copy:src_to_dist',
    'copy:pluginDef',
    'jshint',
    'jscs',
    'sass',
    'babel:dist'
  ]);
};
