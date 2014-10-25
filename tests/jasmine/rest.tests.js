'use strict';

describe('RestController', function() {
  var scope, createController;

  beforeEach(angular.mock.module('kopf'));

  beforeEach(angular.mock.inject(function($rootScope, $controller, $injector) {
    this.scope = $rootScope.$new();
    var $timeout = $injector.get('$timeout');
    var $location = $injector.get('$location');
    this.AlertService = $injector.get('AlertService');
    this.AceEditorService = $injector.get('AceEditorService');
    this.ElasticService = $injector.get('ElasticService');
    this.ElasticService.client = {};
    this.createController = function() {
      return $controller('RestController', {$scope: this.scope}, $location,
          $timeout, this.AlertService, this.AceEditorService,
          this.ElasticService);
    };
    this._controller = this.createController();
  }));

  it('initial values are set', function() {
    expect(this.scope.editor).toEqual(null);
    expect(this.scope.request.path).toEqual("/_search");
    expect(this.scope.request.method).toEqual("GET");
    expect(this.scope.request.body).toEqual("{}");
    expect(this.scope.validation_error).toEqual(null);
    expect(this.scope.history).toEqual([]);
  });

  it('correctly instantiates components when tab is first laoded', function() {
    var mockEditor = {setValue: function(body) {}};
    spyOn(this.scope, 'initEditor').andCallThrough();
    spyOn(this.AceEditorService, 'init').andReturn(mockEditor);
    spyOn(mockEditor, 'setValue').andReturn(true);
    spyOn(this.scope, 'loadHistory').andReturn([ '1', '2']);

    this.scope.initializeController();

    expect(this.scope.initEditor).toHaveBeenCalled();
    var editorId = 'rest-client-editor';
    expect(this.AceEditorService.init).toHaveBeenCalledWith(editorId);
    expect(mockEditor.setValue).toHaveBeenCalledWith('{}');
    expect(this.scope.loadHistory).toHaveBeenCalled();
    expect(this.scope.history).toEqual(['1', '2']);
  });

  it('load a previous request', function() {
    var mockEditor = {setValue: function(body) {}};
    this.scope.editor = mockEditor;
    spyOn(this.scope.editor, 'setValue').andReturn(true);

    var request = new Request("/test_rest/_search", "POST", "{'uno': 'dos'}");
    this.scope.loadFromHistory(request);

    expect(this.scope.request.path).toEqual("/test_rest/_search");
    expect(this.scope.request.method).toEqual("POST");
    expect(this.scope.request.body).toEqual("{'uno': 'dos'}");
    expect(this.scope.editor.setValue).toHaveBeenCalledWith("{'uno': 'dos'}");
  });

  it('load valid request history', function() {
    spyOn(localStorage, 'getItem').andReturn('[{ "path": "/_search", "method": "POST", "body": "{}"}]');
    var history = this.scope.loadHistory();
    expect(history.length).toEqual(1);
    expect(history[0].equals(new Request("/_search", "POST", "{}"))).toEqual(true);
  });

  it('load old-format valid request history', function() {
    spyOn(localStorage, 'getItem').andReturn('[{ "url": "http://oldhost:9200/_search", "method": "POST", "body": "{}"}]');
    var history = this.scope.loadHistory();
    expect(history.length).toEqual(1);
    expect(history[0].equals(new Request("/_search", "POST", "{}"))).toEqual(true);
  });

  it('load invalid request history', function() {
    spyOn(localStorage, 'getItem').andReturn('[ "url": "http://oldhost:9200/_search", "method": "POST", "body": "{}"}]');
    spyOn(localStorage, 'setItem').andReturn(true);
    var history = this.scope.loadHistory();
    expect(history.length).toEqual(0);
    expect(localStorage.setItem).toHaveBeenCalledWith('kopf_request_history', null);
  });

  it('add request to history', function() {
    spyOn(localStorage, 'setItem').andReturn(true);
    var request = new Request("/test_rest/_search", "POST", "{'uno': 'dos'}");
    expect(this.scope.history.length).toEqual(0);
    this.scope.addToHistory(request);
    expect(this.scope.history.length).toEqual(1);
    var historyRaw = JSON.stringify(this.scope.history);
    expect(localStorage.setItem).toHaveBeenCalledWith('kopf_request_history', historyRaw);
  });

  it('to not add duplicates to request to history', function() {
    var request = new Request("/test_rest/_search", "POST", "{'uno': 'dos'}");
    expect(this.scope.history.length).toEqual(0);
    this.scope.addToHistory(request);
    expect(this.scope.history.length).toEqual(1);
    spyOn(localStorage, 'setItem').andReturn(true);
    this.scope.addToHistory(request);
    expect(this.scope.history.length).toEqual(1);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('limit history request to 30', function() {
    var request = new Request("/test_rest/_search", "POST", "{'uno': 'dos'}");
    var history = [];
    for (var i = 0; i < 30; i++) {
      history.push(new Request("/test_rest/_search", "POST", "{'uno': '" + i + " '}"));
    }
    this.scope.history = history;
    expect(this.scope.history.length).toEqual(30);
    this.scope.addToHistory(request);
    expect(this.scope.history.length).toEqual(30);
    expect(this.scope.history[0].equals(request)).toEqual(true);
  });

  it('executes a correct request', function() {
    this.scope.request = new Request("/test_rest/_search", "POST", "{'uno': 'dos'}");
    this.ElasticService.client.clusterRequest = function() {};
    this.scope.editor = { format: function() { return "{'uno': 'dos'}"; } };
    spyOn(this.AlertService, 'warn').andReturn(true);
    spyOn(this.scope.editor, 'format').andCallThrough();
    spyOn(this.ElasticService.client, 'clusterRequest').andReturn(true);
    this.scope.sendRequest();
    expect(this.ElasticService.client.clusterRequest).toHaveBeenCalledWith("POST", "/test_rest/_search", "{'uno': 'dos'}", jasmine.any(Function), jasmine.any(Function));
    expect(this.AlertService.warn).not.toHaveBeenCalled();
  });

  it('executes a request without path', function() {
    this.scope.request = new Request("", "POST", "{'uno': 'dos'}");
    spyOn(this.AlertService, 'warn').andReturn(true);
    this.scope.sendRequest();
    expect(this.AlertService.warn).toHaveBeenCalledWith('Path is empty');
  });

  it('executes a GET request with non empty body', function() {
    this.scope.request = new Request("/test_rest/_search", "GET", "{'uno': 'dos'}");
    this.ElasticService.client.clusterRequest = function() {};
    this.scope.editor = { format: function() { return "{'uno': 'dos'}"; } };
    spyOn(this.AlertService, 'info').andReturn(true);
    spyOn(this.scope.editor, 'format').andCallThrough();
    spyOn(this.ElasticService.client, 'clusterRequest').andReturn(true);
    this.scope.sendRequest();
    expect(this.ElasticService.client.clusterRequest).toHaveBeenCalledWith("GET", "/test_rest/_search", "{'uno': 'dos'}", jasmine.any(Function), jasmine.any(Function));
    expect(this.AlertService.info).toHaveBeenCalledWith('You are executing a GET request with body ' +
        'content. Maybe you meant to use POST or PUT?');
  });


});