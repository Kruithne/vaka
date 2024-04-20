const proxy_to_bindings_map = new WeakMap();
const element_lookup = new WeakMap();

export const REJECT_CHANGE = Symbol('VAKA_REJECT_CHANGE');

export class VakaError extends Error {
	static ERR_UNSUPPORTED_BIND = 0x1;
	static ERR_NON_REACTIVE_STATE = 0x2;
	static ERR_INVALID_OBJECT_PATH = 0x3;
	static ERR_BAD_PROXY = 0x4;
	static ERR_DUPLICATE_BINDING = 0x5;
	static ERR_INVALID_ELEMENT_ID = 0x6;

	constructor(code, ...params) {
		super(fmt(ERROR_STRINGS[code], ...params));
		this.name = this.constructor.name;
		this.code = code;

		if (Error.captureStackTrace)
			Error.captureStackTrace(this, VakaError);
	}
}

const ERROR_STRINGS = {
	[VakaError.ERR_UNSUPPORTED_BIND]: '"{}" is not a supported target for bind()',
	[VakaError.ERR_NON_REACTIVE_STATE]: 'Attempted to bind to a non-reactive state object',
	[VakaError.ERR_INVALID_OBJECT_PATH]: 'Unable to resove object path "{}"',
	[VakaError.ERR_BAD_PROXY]: 'Proxy trap called without a valid state object',
	[VakaError.ERR_DUPLICATE_BINDING]: 'Element already bound to a reactive state property',
	[VakaError.ERR_INVALID_ELEMENT_ID]: 'Attempted to bind to an invalid element ID "{}"',
}

function panic(code, ...params) {
	throw new VakaError(code, ...params);
}

/**
 * Formats a string, substituting placeholders with the provided parameters.
 * 
 * Placeholders are in the form of {n}, where n is the index of the parameter.
 * 
 * Indexless parameters are filled in order.
 * 
 * ```js
 * fmt('Hello, {0}!', 'world') => 'Hello, world!'
 * fmt('Hello, {}!', 'world') => 'Hello, world!'
 * fmt('Hello, {1}! My name is {0}.', 'John', 'world') => 'Hello, world! My name is John.'
 * ```
 * @param {string} str 
 * @param  {...any} params 
 * @returns {string}
 */
export function fmt(str, ...params) {
	let i = 0;
	return str.replace(/{(\d*)}/g, (match, p1) => {
		if (p1 === '')
			return params[i++];

		return params[parseInt(p1)];
	});
}

function update_target(target, value) {
	if (target instanceof HTMLInputElement) {
		target.value = value;
		return;
	}

	target.innerText = value;
}

/**
 * Resolves a nested object property path.
 * 
 * ```js
 * const obj = {
 * 	foo: {
 * 		bar: 'baz'
 * 	}
 * };
 * 
 * const [base, key] = resolve_object_property(obj, 'foo.bar');
 * // base = obj.foo, key = 'bar'
 * ```
 * @param {object} target 
 * @param {string} property 
 * @returns 
 */
function resolve_object_property(target, property) {
	const path_parts = property.split('.');
	const parts_len = path_parts.length;

	let base_state = target;
	for (let i = 0; i < parts_len - 1; i++) {
		const part = path_parts[i];
		if (!base_state.hasOwnProperty(part))
			panic(VakaError.ERR_INVALID_OBJECT_PATH, property);

		base_state = base_state[part];
	}

	return [base_state, path_parts[parts_len - 1]];
}

function get_property_state(state, key) {
	if (!state.has(key))
		state.set(key, { bindings: new Set(), watchers: new Set() });

	return state.get(key);
}

const proxy_handlers = {
	set(target, property, value, receiver) {
		const state_meta = proxy_to_bindings_map.get(receiver);
		if (!state_meta)
			panic(VakaError.ERR_BAD_PROXY);

		const property_state = get_property_state(state_meta, property);

		let new_value = value;
		for (const watcher of property_state.watchers) {
			const watcher_return = watcher(target[property], value);

			if (watcher_return === REJECT_CHANGE)
				new_value = target[property];
			else if (watcher_return !== undefined)
				new_value = watcher_return;
		}

		for (const binding of property_state.bindings)
			update_target(binding, new_value);

		target[property] = new_value;
		return true;
	}
};

/**
 * Creates a reactive state object with the provided initial state. Updating properties on this object will update anything bound to that property.
 * ```js
 * const state = reactive({
 * 	foo: 'bar'
 * 	qux: {
 * 		baz: 'quux'
 * 	}
 * });

 * state.foo = 'baz'; // this propagates to anything bound to `foo`.
 * state.qux.baz = 'corge'; // nested objects are reactive too.
 * ```
 * @param {object} initial_state 
 * @returns {Proxy<object>}
 */
export function reactive(initial_state) {
	const proxy = new Proxy(initial_state, proxy_handlers);

	proxy_to_bindings_map.set(proxy, new Map());

	// apply proxies recursively to nested objects
	for (const [key, value] of Object.entries(initial_state)) {
		if (typeof value === 'object' && value !== null)
			initial_state[key] = reactive(value);
	}

	return proxy;
}

/**
 * Bind a reactive state property to a valid target. When the property is updated, the target will be updated to reflect the new value.
 * 
 * Currently supported targets are DOM elements inheriting from `HTMLElement`.
 * 
 * ```js
 * const my_element = $('#my-element'); // div
 * const state = reactive({
 * 	foo: 'bar'
 * });
 * 
 * bind(my_element, state, 'foo');
 * state.foo = 'baz'; // this will update the innerText of `my_element`.
 * ```
 * 
 * For brevity, `element` can be an element ID which will be resolved to an element using `document.getElementById`.
 * @param {HTMLElement|string} element 
 * @param {Proxy<object>} state 
 * @param {string} property 
 */
export function bind(element, state, property) {
	if (typeof element === 'string') {
		const element_id = element;
		element = document.getElementById(element);

		if (!element)
			panic(VakaError.ERR_INVALID_ELEMENT_ID, element_id);
	}

	if (!(element instanceof HTMLElement)) {
		let target_type = typeof target;
		if (target_type === 'object')
			target_type = target === null ? 'null' : target.constructor.name;

		panic(VakaError.ERR_UNSUPPORTED_BIND, target_type);
	}

	if (element_lookup.has(element))
		panic(VakaError.ERR_DUPLICATE_BINDING);

	const [base_state, current_key] = resolve_object_property(state, property);
	const state_meta = proxy_to_bindings_map.get(base_state);
	if (!state_meta)
		panic(VakaError.ERR_NON_REACTIVE_STATE);

	update_target(element, base_state[current_key]);

	let callback;
	if (element instanceof HTMLInputElement) {
		callback = () => base_state[current_key] = element.value;
		element.addEventListener('input', callback);
	}

	get_property_state(state_meta, current_key).bindings.add(element);

	element_lookup.set(element, {
		attached_handler: callback,
		reactive_target: base_state,
		reactive_key: current_key
	});
}

/**
 * Unbind the reactivity of the given target.
 * @param {HTMLElement|string} element 
 * @returns 
 */
export function unbind(element) {
	if (typeof element === 'string') {
		const element_id = element;
		element = document.getElementById(element);

		if (!element)
			panic(VakaError.ERR_INVALID_ELEMENT_ID, element_id);
	}

	const element_meta = element_lookup.get(element);
	if (!element_meta)
		return;

	if (element_meta.attached_handler)
		element.removeEventListener('input', element_meta.attached_handler);

	const state_meta = proxy_to_bindings_map.get(element_meta.reactive_target);
	state_meta.get(element_meta.reactive_key).bindings.delete(element);
}

/**
 * Hook a callback to a reactive state property to be called when the property is updated.
 * @param {Proxy} state 
 * @param {string} property 
 * @param {function} callback 
 */
export function watch(state, property, callback) {
	const [base_state, current_key] = resolve_object_property(state, property);
	const state_meta = proxy_to_bindings_map.get(base_state);
	if (!state_meta)
		panic(VakaError.ERR_NON_REACTIVE_STATE);

	get_property_state(state_meta, current_key).watchers.add(callback);
}