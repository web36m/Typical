var T = require('./simple');
var test = require('./test');
assert = test.assert;
assert_fail = test.assert_fail;
render = test.render;

assert_fail(function() {
  return T(Number, Number, function(x) { return x })("1");
});
assert(function() {
  return T(Number, Number, function(x) { return x })(1);
});
assert(function() {
  return T([Number], Number, function(x) { return x[0] })([1]);
});

var id = T.forall(function(A) {
  // A -> A forall A
  return T(A, A, function(x) {
    return x;
  });
});
assert(function() {
  return id(12);
});
assert(function() {
  return id("abc");
});
assert(function() {
  return id({a:false});
});
assert(function() {
  return id([1,2,3]);
});

var retype = T.forall(function(A) {
  // A -> A, fail when A != [String -> Number]
  return T.enforce(A, A, function(x) { 
    return T(String, Number, function(x) { return x }) 
  });
});
assert_fail(function() {
  return retype(T(Number, Number, function(x) { return x; })); 
});
assert(function() {
  return retype(T(String, Number, function(x) { return x; })); 
});

var Or = T.forall(function(atoc) {
  return function(f) {
    return T.forall(function(btoc) {
      return function(g) {
	return function(x) {
	  if( atoc.type[0](x) ) {
	    return f(x);
	  } else {
	    return g(x);
	  }
	};
      };
    });
  };
});
var first = T([Number], Number, function(xs) { return xs[0] });
assert(function() {
  return first([1,2,3]);
});
var aObj = T({a:Number}, Number, function(o) { return o.a  });
assert(function() {
  return aObj({a:1});
});
assert(function() {
  return Or(first)(aObj)({a:1});
});
assert(function() {
  return Or(first)(aObj)([1,2]);
});

render();

