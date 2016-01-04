"use strict";
var through = require('through');
var path = require('path');
var gutil = require('gulp-util');
var merge = require('merge');
var PluginError = gutil.PluginError;
var File = gutil.File;

module.exports = function (fileName, converter) {
  var config;
  var defaults = {
    dataConverter: dataConverter,
    pathConverter: pathConverter
  };

  function dataConverter(data) {
    return new Buffer(JSON.stringify(data, null, '\t'));
  }

  function pathConverter(file) {
    return file.relative.substr(0,file.relative.length-5);
  }

  var data = {};
  var firstFile = null;
  //We keep track of when we should skip the conversion for error cases
  var skipConversion = false;

  if (!fileName) {
    throw new PluginError('gulp-jsoncombine', 'Missing fileName option for gulp-jsoncombine');
  }

  if(typeof converter === 'object') {
    config = merge.recursive(defaults, converter);
  } else {
    config = defaults;

    if(typeof converter === 'function') {
      config.dataConverter = converter;
    }
  }

  if (!config.hasOwnProperty('dataConverter') && typeof config.dataConverter !== 'function') {
    throw new PluginError('gulp-jsoncombine', 'Missing data converter option for gulp-jsoncombine');
  }

  if (!config.hasOwnProperty('pathConverter') && typeof config.pathConverter !== 'function') {
    throw new PluginError('gulp-jsoncombine', 'Missing path converter option for gulp-jsoncombine');
  }

  function bufferContents(file) {
    if (!firstFile) {
      firstFile = file;
    }

    if (file.isNull()) {
      return; // ignore
    }

    if (file.isStream()) {
      skipConversion = true;
      return this.emit('error', new PluginError('gulp-jsoncombine', 'Streaming not supported'));
    }

    try {
      data[config.pathConverter(file)] = JSON.parse(file.contents.toString());
    } catch (err) {
      skipConversion = true;
      return this.emit('error',
        new PluginError('gulp-jsoncombine', 'Error parsing JSON: ' + err + ', file: ' + file.path.slice(file.base.length)));
    }
  }

  function endStream() {
    if (firstFile && !skipConversion) {
      var joinedPath = path.join(firstFile.base, fileName);

      try {
        var joinedFile = new File({
          cwd: firstFile.cwd,
          base: firstFile.base,
          path: joinedPath,
          contents: config.dataConverter(data)
        });

        this.emit('data', joinedFile);
      } catch (e) {
        return this.emit('error', new PluginError('gulp-jsoncombine', e, { showStack: true }));
      }
    }

    this.emit('end');
  }

  return through(bufferContents, endStream);
};
