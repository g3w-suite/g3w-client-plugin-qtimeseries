//Gulp
const gulp   = require('gulp');
const rename = require('gulp-rename');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const gutil = require("gulp-util");
const browserify = require('browserify');
const babelify = require('babelify');
const watchify = require('watchify');
const vueify = require('vueify');
const stringify = require('stringify');
const sourcemaps = require('gulp-sourcemaps');
let production = false;
let sourcemap = false;

gulp.task('browserify', [], function() {
  var bundler = browserify('./index.js', {
    basedir: "./",
    paths: ["./", '../'],
    debug: !production,
    cache: {},
    packageCache: {}
  });
  if (!production) bundler = watchify(bundler);
  bundler.transform(vueify)
  .transform(babelify, {
    babelrc: true
  });
  bundler.transform(stringify, {
    appliesTo: { includeExtensions: ['.html'] }
  });

  var bundle = function(){
    return bundler.bundle()
      .on('error', function(err){
        console.log(err);
        process.exit();
      })
      .pipe(source('build.js'))
      .pipe(buffer())
      .pipe(gulpif(sourcemap, sourcemaps.init()))
      .pipe(gulpif(production, uglify({
          compress: {
            drop_console: true
          }
        }).on('error', gutil.log))
      )
      .pipe(rename('plugin.js'))
      .pipe(gulpif(sourcemap, sourcemaps.write('.')))
      .pipe(gulp.dest('.'));
  };

  var rebundle;
  const del = require('del');
  del(['./plugin.js.map']);
  if (!production) {
    rebundle = function(){
      return bundle();
    };
    bundler.on('update', rebundle);
  }
  else {
    rebundle = function(){
      return bundle();
    }
  }
  return rebundle();
});


gulp.task('production', function(){
    production = true;
});

gulp.task('sourcemap', function(){
  sourcemap = true;
});


gulp.task('watch',['browserify']);

gulp.task('default-sourcemap',['production', 'sourcemap', 'browserify']);

gulp.task('default',['production','browserify']);



