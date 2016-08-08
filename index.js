#!/usr/bin/env node

'use strict';

var raml = require('raml-1-parser');
var fs = require('fs');
var Q = require('q');

function _parseBaseUri(ramlObj) {
  // I have no clue what kind of variables the RAML spec allows in the baseUri.
  // For now keep it super super simple.
  if (ramlObj.baseUri) {
    ramlObj.baseUri = ramlObj.baseUri.replace('{version}', ramlObj.version);
  }
  return ramlObj;
}

function _ltrim(str, chr) {
  var rgxtrim = (!chr) ? new RegExp('^\\s+') : new RegExp('^' + chr + '+');
  return str.replace(rgxtrim, '');
}

function _makeUniqueId(resource) {
  var fullUrl = resource.parentUrl + resource.relativeUri;
  return _ltrim(fullUrl.replace(/\W/g, '_'), '_');
}

function _traverse(ramlObj, parentUrl, allUriParameters) {
  // Add unique id's and parent URL's plus parent URI parameters to resources
  for (var index in ramlObj.resources) {
    if (ramlObj.resources.hasOwnProperty(index)) {
      var resource = ramlObj.resources[index];
      resource.parentUrl = parentUrl || '';
      resource.uniqueId = _makeUniqueId(resource);
      resource.allUriParameters = [];

      if (allUriParameters) {
        resource.allUriParameters.push.apply(resource.allUriParameters, allUriParameters);
      }

      if (resource.uriParameters) {
        for (var key in resource.uriParameters) {
          if (resource.uriParameters.hasOwnProperty(key)) {
            resource.allUriParameters.push(resource.uriParameters[key]);
          }
        }
      }

      if (resource.methods) {
        for (var methodkey in resource.methods) {
          if (resource.methods.hasOwnProperty(methodkey)) {
            resource.methods[methodkey].allUriParameters = resource.allUriParameters;
          }
        }
      }

      _traverse(resource, resource.parentUrl + resource.relativeUri, resource.allUriParameters);
    }
  }

  return ramlObj;
}

function _addUniqueIdsToDocs(ramlObj) {
  // Add unique id's to top level documentation chapters
  for (var idx in ramlObj.documentation) {
    if (ramlObj.documentation.hasOwnProperty(idx)) {
      var docSection = ramlObj.documentation[idx];
      docSection.uniqueId = docSection.title.replace(/\W/g, '-');
    }
  }
  return ramlObj;
}

function _enhanceRamlObj(ramlObj) {
  ramlObj = _parseBaseUri(ramlObj);
  ramlObj = _traverse(ramlObj);
  return _addUniqueIdsToDocs(ramlObj);
}

function exists(fp){
  try {
    fs.accessSync(fp);
    return true;
  } catch (e) {
    return false;
  }
};

function _sourceToRamlObj(source) {
  if (typeof source === 'string') {
    if (exists(source) || source.indexOf('http') === 0) {
      // Parse as file or url
      return raml.loadApi(source, { rejectOnErrors: true }).then(function(raml) {
        return raml.expand().toJSON();
      });
    }

    return Q.fcall(function() {
      throw new Error('_sourceToRamlObj: source does not exist');
    });
  } else if (typeof source === 'object') {
    // Parse RAML object directly
    return Q.fcall(function() {
      return source;
    });
  }

  return Q.fcall(function() {
    throw new Error('_sourceToRamlObj: You must supply either file, url, or obj as source.');
  });
}

function parse(source) {
  return _sourceToRamlObj(source).then(function(ramlObj) {
    return _enhanceRamlObj(ramlObj);
  });
}

module.exports.parse = parse;