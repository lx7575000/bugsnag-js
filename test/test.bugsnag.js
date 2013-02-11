describe("Bugsnag", function () {
  beforeEach(buildUp);
  afterEach(tearDown);

  describe("notifyException", function () {
    it("should not notify if apiKey is not set", function () {
      Bugsnag.apiKey = null;
      Bugsnag.notifyException(new Error("Example error"));

      assert(!Bugsnag.testRequest.called, "Bugsnag.testRequest should not have been called");
    });
      
    it("should not notify if apiKey is invalid", function () {
      Bugsnag.apiKey = "bad-api-key";
      Bugsnag.notifyException(new Error("Example error"));
      
      assert(!Bugsnag.testRequest.called, "Bugsnag.testRequest should not have been called");
    });

    it("should contain an apiKey", function () {
      Bugsnag.notifyException(new Error("Example error"));

      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert(!!requestData().params.apiKey, "apiKey should be in request params");
    });

    it("should contain the correct exception class", function () {
      Bugsnag.notifyException(new URIError("Example error"));

      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(requestData().params.name, "URIError");
    });

    it("should contain the correct exception message", function () {
      Bugsnag.notifyException(new Error("Example error"));
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(requestData().params.message, "Example error");
    });

    it("should contain a stacktrace", function () {
      try {
        throw new Error("Example error");
      } catch (e) {
        Bugsnag.notifyException(e);
      }
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert(requestData().params.stacktrace != null, "stacktrace should be in request params");
    });

    it("should contain a releaseStage if set", function () {
      Bugsnag.releaseStage = "development";
      Bugsnag.notifyException(new Error("Example error"));

      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(requestData().params.releaseStage, "development");
    });

    it("should contain global metaData if set", function () {
      var metaData = {some: {data: "here"}};
      
      Bugsnag.metaData = metaData;
      Bugsnag.notifyException(new Error("Example error"));
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.deepEqual(requestData().params.metaData, metaData, "metaData should match");
    });

    it("should contain local metaData if set", function () {
      var metaData = {some: {data: "here"}};
      
      Bugsnag.notifyException(new Error("Example error"), metaData);
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.deepEqual(requestData().params.metaData, metaData, "metaData should match");
    });

    it("should contain merged metaData if both local and global metaData are set", function () {
      var globalMetaData = {some: {data: "here"}};
      var localMetaData = {some: {extra: {data: "here"}}};
      
      Bugsnag.metaData = globalMetaData;
      Bugsnag.notifyException(new Error("Example error"), localMetaData);
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.deepEqual(requestData().params.metaData, {
        some: {
          data: "here",
          extra: { data: "here" }
        }
      }, "metaData should match");
    });

    it("should use the https://notify.bugsnag.com/js endpoint by default", function () {
      Bugsnag.notifyException(new Error("Example error"));
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(requestData().url, "https://notify.bugsnag.com/js");
    });
  });
  
  describe("notify", function () {
    it("should contain the correct error name", function () {
      Bugsnag.notify("CustomError", "Something broke");
    
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(requestData().params.name, "CustomError");
    });

    it("should contain the correct error message", function () {
      Bugsnag.notify("CustomError", "Something broke");
    
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(requestData().params.message, "Something broke");
    });

    it("should contain an auto-generated stacktrace", function () {
      Bugsnag.notify("CustomError", "Something broke");
      
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert(requestData().params.stacktrace != null, "stacktrace should be present");
    });
  });
});

describe("window", function () {
  beforeEach(buildUp);
  afterEach(tearDown);

  it("should contain a Bugsnag object", function () {
    assert("Bugsnag" in window, "should have Bugsnag object on window");
  });

  describe("onerror", function() {
    it("should notify bugsnag", function () {
      Bugsnag._onerror = null; // Disable mocha's onerror for this test
  
      window.onerror("Something broke", "http://example.com/example.js", 123);
  
      var params = requestData().params;
      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert.equal(params.name, "window.onerror");
      assert.equal(params.message, "Something broke");
      assert.equal(params.lineNumber, 123);
    });

    it("should call the original onerror", function () {
      Bugsnag._onerror = function () {
        Bugsnag._onerror.called = true;
      };

      stub(Bugsnag, "_onerror");
      
      window.onerror("Something broke", "http://example.com/example.js", 123);

      assert(Bugsnag.testRequest.calledOnce, "Bugsnag.testRequest should have been called once");
      assert(Bugsnag._onerror.calledOnce, "Bugsnag._onerror should have been called once");
    });
  });
});

function buildUp(cb) {
  // Keep track of mocha's window.onerror
  window._onerror = window.onerror;

  // Create bugsnag.js script tag
  var bugsnag = document.createElement("script");
  bugsnag.id = "bugsnag";
  bugsnag.type = "text/javascript";
  bugsnag.src = "../dist/bugsnag.js";
  bugsnag.onload = bugsnag.onreadystatechange = function () {
    if(!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
      // Set api key to use when testing
      Bugsnag.apiKey = "9e68f5104323042c09d8809674e8d05c";

      // Stub out requests
      stub(Bugsnag, "testRequest");

      // Setup is done
      cb();
    }
  };

  // Add bugsnag.js script tag to dom
  document.getElementsByTagName("body")[0].appendChild(bugsnag);
}

function tearDown() {
  // Remove the bugsnag.js script tag
  var bugsnag = document.getElementById("bugsnag");
  bugsnag.parentNode.removeChild(bugsnag);

  // Remove the Bugsnag object
  window.Bugsnag = null;

  // Reset mocha's window.onerror
  window.onerror = window._onerror;
  window._onerror = null
}

function requestData() {
  var args = Bugsnag.testRequest.args;
  return {
    url: Bugsnag.testRequest.args[0][0],
    params: Bugsnag.testRequest.args[0][1]
  };
}

// Micro assertion library (works in old IE)
function assert(statement, message) {
  if(statement == false) {
    throw new Error(message);
  }
}

assert.equal = function (a, b, message) {
  assert(a == b, message);
};

assert.deepEqual = function (a, b, message) {
  assert(deepEqual(a, b));
};

// Micro stubbing library
function stub(obj, fname) {
  origFunction = obj[fname];
  obj[fname] = function () {
    var self = obj[fname];
    self.args = self.args || [];
    self.args.push(arguments);
    self.calledCount = self.calledCount ? self.calledCount + 1 : 1;
    self.calledOnce = (self.calledCount == 1);
    self.called = true;
    self.restore = function () { obj[fname] = origFunction };
    return self;
  };

  obj[fname].origFunction = origFunction;
}