# 👁️‍🗨️ vaka &middot; ![typescript](https://img.shields.io/badge/language-javascript-f0db4f) [![license badge](https://img.shields.io/github/license/Kruithne/nwjs-installer?color=blue)](LICENSE) ![npm version](https://img.shields.io/npm/v/vaka-js?color=blue)

`vaka` is a tiny JavaScript library that provides a reactive state system inspired by Vue.js.

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

## Features

Coming Soon

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

This error is thrown when the first argument to `bind()` is not a valid target. Valid targets for `bind()` currently consist of DOM elements inheriting from `HTMLElement`.

## Motivation

Reactivity as a concept is great for web development. It allows the gap between HTML (DOM) and JS to be bridged much more seamlessly, getting rid of endless boilerplate.

But to get reactivity, you often need to bring in the whole kitchen. Vue.js is my favourite reactive framework, however pulling in a 400kb file just to get reactivity feels unnecessary, and I often end up just going without - cost outweighs benefit.

I built `vaka` to try a fresh approach at reactivity, without building a rocketship.

## Footnotes

`vaka` is inspired by the concepts of Vue.js. A lot of terminology may be carried over as coming up with a whole new appendix of terminology just to be unique is confusing and pointless.

The name `vaka` comes from Old Norse; to watch, to keep a watchful eye.