# 👁️‍🗨️ vaka &middot; ![typescript](https://img.shields.io/badge/language-javascript-f0db4f) [![license badge](https://img.shields.io/github/license/Kruithne/nwjs-installer?color=blue)](LICENSE) ![npm version](https://img.shields.io/npm/v/vaka-js?color=blue)

`vaka` is a tiny JavaScript library that provides a reactive state system inspired by Vue.js.

- [Usage](#usage)
- [Key Points](#key-points)
- [Features](#features)
- [Pitfalls](#pitfalls)
- [Error Handling](#error-handling)
- [Errors](#errors)
- [Motivation](#motivation)
- [Footnotes](#footnotes)

## ⚠️ Active Development

This library is actively in the early stages of development. Feedback is welcome, however I highly recommend not using `vaka` in production until v1.

## Usage

### Method 1: Package Manager

```bash
npm install vaka-js # npm
bun add vaka-js # bun
```

```js
import { reactive, bind } from 'vaka-js';
```

### Method 2: Self-Hosted

```js
import { reactive, bind } from './path/to/vaka.js';
```

## Key Points

- Zero dependencies.
- Built using modern JavaScript features (Proxies, promises, ESM).
- Written in plain JavaScript, no build step required.
- Tree-shakeable.
- Tiny footprint (6kb unminified vs Vue.js 400kb).

## Features

### ⚙️ `reactive(initial_state)`

Creates a reactive state object with the provided initial state. Updating properties on this object will update anything bound to that property.

```js
const state = reactive({
	foo: 'bar'
});

state.foo = 'baz'; // this propagates to anything bound to `foo`.
```

Nested objects are also reactive. Changes to nested properties will propagate to anything bound to the parent object or property.

```js
const state = reactive({
	foo: {
		bar: 'baz'
	}
});

state.foo.bar = 'qux'; // this propagates to anything bound to `foo.bar`.
```

Objects added to a reactive object after creation will be made reactive, but changes to the original object will not propogate, you must reference the reactive object directly.

```js
const state = reactive({ foo: 'bar' }); // initial state

const new_obj = { baz: 'qux' };
state.bar = new_obj;

state.bar.baz = 'quux'; // this propagates to anything bound to `bar.baz`.
new_obj.baz = 'quux'; // this does not propagate.
```

### ⚙️ `bind(element, state, property)`

Bind a reactive state property to a valid target. When the property is updated, the target will be updated to reflect the new value.

Currently supported targets are DOM elements inheriting from `HTMLElement`.

```js
const my_element = $('#my-element'); // div
const state = reactive({
	foo: 'bar'
});

bind(my_element, state, 'foo');
state.foo = 'baz'; // this will update the innerText of `my_element`.
```

Depending on the type of target, the binding will be applied differently. The following targets are currently supported:

| Target | Binding |
|--------|---------|
| HTMLElement | `element.innerText` |
| HTMLInputElement | `element.value` |

For brevity, the `element` parameter can be an element ID string, which will be resolved using `document.getElementById()`.

```js
bind('my-element', state, 'foo');
```

### ⚙️ `unbind(element)`

Unbinds all reactive bindings from the provided element.

```js
const my_element = $('#my-element');
const state = reactive({
	foo: 'bar'
});

bind(my_element, state, 'foo');
state.foo = 'baz'; // this will update the innerText of `my_element`.

unbind(my_element);

state.foo = 'qux'; // this will not update `my_element`.
```

For brevity, the `element` parameter can be an element ID string, which will be resolved using `document.getElementById()`.

```js
unbind('my-element');
```

### ⚙️ `watch(state, property, callback)`

Watch a reactive state property for changes. When the property is updated, the provided callback will be invoked.

```js
const state = reactive({
	foo: 'bar'
});

watch(state, 'foo', (orig_value, new_value) => {
	console.log(`foo changed from ${orig_value} to ${new_value}`);
});

state.foo = 'baz'; // this will log "foo changed from bar to baz".
```

In addition to being a callback, the return value of a watcher is used to validate or reject the property change.

Returning `undefined` (or nothing) will allow the change to proceed. Returning the `REJECT_CHANGE` constant exported from `vaka` will reject the change.

```js
const state = reactive({
	foo: 'bar'
});

watch(state, 'foo', (orig_value, new_value) => {
	if (new_value === 'baz')
		return REJECT_CHANGE;
});

state.foo = 'baz'; // this will not update `foo`.
```
If any other value is returned from the watcher, including `null` and falsy values, that value will be used as the new value for the property.

```js
const state = reactive({
	foo: 5000
});

watch(state, 'foo', (orig_value, new_value) => {
	if (typeof new_value !== 'number')
		return parseInt(new_value);
});

state.foo = '100'; // this will update `foo` to 100.
```
## Pitfalls

- 🚧 Reactive HTML elements are monitored for `input` events. Setting their `.value` programatically from JavaScript does not trigger reactivity.
- 🚧 Directly modifying an object used to initiate state, or one that is inserted into a reactive object after creation, will not trigger reactivity. Always reference the proxy!

## Error Handling

When an error occurs in `vaka` a `VakaError` is thrown. This error contains a `code` property which can be used to quickly identify the error type for fine-grained error handling.

```js
try {
	bind(null, state, 'foo'); // null is not a valid target for bind()
} catch (error) {
	if (error instanceof VakaError) {
		switch (error.code) {
			case VakaError.ERR_UNSUPPORTED_BIND:
				// Handle this specific error type as needed.
				break;
		}
	}
}
```

The `VakaError` class is exported from the `vaka` module and can be used to access the error codes, which are listed below.

## Errors

`VakaError.ERR_UNSUPPORTED_BIND`

Thrown when the first argument to `bind()` is not a valid target. Valid targets for `bind()` currently consist of DOM elements inheriting from `HTMLElement`.

```js
bind({}, state, 'foo'); // {} is not a valid target for bind().
```

`VakaError.ERR_NON_REACTIVE_STATE`

Thrown when a non-reactive state object is provided to `bind()`. Ensure the state object is created using `reactive()` before attempting to bind it.

```js
const state = { foo: 'bar' };
bind(my_element, state, 'foo'); // state is not reactive.
```

`VakaError.ERR_INVALID_ELEMENT_ID`

Thrown when an element ID string is provided to `bind()` or `unbind()` but the element cannot be resolved using `document.getElementById()`.

```js
bind('non-existent-element', state, 'foo'); // element does not exist.
```

`VakaError.ERR_INVALID_OBJECT_PATH`

Thrown when a property path cannot be resolved on the provided object.

```js
const state = reactive({ foo: { bar: 'baz' } });
bind(my_element, state, 'foo.bar.qux'); // 'qux' does not exist on 'foo'.
```

`VakaError.ERR_DUPLICATE_BINDING`

Thrown when attempting to bind an element to a reactive property when that element is already bound to a different property.

This error is thrown instead of silently unbinding the previous property to prevent unexpected behaviour. If you wish to rebind an element to a different property, you should unbind it first. Binding to multiple properties is not supported.

```js
const state = reactive({ foo: 'bar', baz: 'qux' });
bind(my_element, state, 'foo');
bind(my_element, state, 'baz'); // throws ERR_DUPLICATE_BINDING
```

`VakaError.ERR_BAD_PROXY`

Thrown when a proxy trap is called on a non-reactive object. This should never occur in normal usage.

## Motivation

Reactivity as a concept is great for web development. It allows the gap between HTML (DOM) and JS to be bridged much more seamlessly, getting rid of endless boilerplate.

But to get reactivity, you often need to bring in the whole kitchen. Vue.js is my favourite reactive framework, however pulling in a 400kb file just to get reactivity feels unnecessary, and I often end up just going without - cost outweighs benefit.

I built `vaka` to try a fresh approach at reactivity, without building a rocketship.

## Footnotes

`vaka` is inspired by the concepts of Vue.js. A lot of terminology may be carried over as coming up with a whole new appendix of terminology just to be unique is confusing and pointless.

The name `vaka` comes from Old Norse; to watch, to keep a watchful eye.