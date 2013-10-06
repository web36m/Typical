var assert;
try {
  T = require('./typical')
  assert = console.log.bind(console);
} catch(err) {
  // no require necessary in browser
  assert = render;
}
T()

// typed function definition
map = T(function(f, xs) { return xs.map(f) }, T([Number, Number]), [Number], [Number])
f = T(function(x) { return x+1 }, Number, Number)

assert("inline typing", map(f, [1,2,3]))

// retroactive typing
map2 = function(f, xs) { return xs.map(f) }
T(map2, T([Number, Number]), [Number], [Number])
f2 = function(x) { return x+1 }
T(f2, Number, Number)

assert("type annotations", map2(f2, [1,2,3]))

// Trivial circular type
circleTest = T(function(x) { return 0; }, [T.Circular], Number)
assert("recursive types", circleTest([[]]))

// Algebraic type
algebraic = T(function(x) { return typeof x == 'number' ? x : parseInt(x); }, T.Or(Number, String), Number)
assert("polymorphic functions", algebraic("3")+algebraic(3))

// Complex circular type
Linked = [T.Or(Number, T.Circular)]
linkedList = T(function(x) {
  if( x.length == 0 ) return []
  return [x[0], linkedList(x.slice(1))]
}, [Number], Linked)
assert("linked list", linkedList([1,2,3]))
console.log(linkedList.signature)
