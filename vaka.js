const state_map = new WeakMap();

function update_target(target, value) {
	if (target instanceof HTMLElement) {
		if (target instanceof HTMLInputElement) {
			target.value = value;
			return;
		}

		target.textContent = value;
		return;
	}
	
	throw new Error('unsupported target for bind()');
}

export function reactive(state) {
	const handler = {
		set(target, property, value, receiver) {
			target[property] = value;

			const bindings = state_map.get(receiver)?.bindings?.get(property);
			if (bindings)
				for (const binding of bindings)
					update_target(binding, value);
		}
	};

	const proxy = new Proxy(state, handler);

	state_map.set(proxy, {
		bindings: new Map()
	});

	return proxy;
}

export function bind(element, state, property) {
	update_target(element, state[property]);

	const state_meta = state_map.get(state);
	if (!state_meta)
		throw new Error('bind() called on a non-reactive state object');

	const bindings = state_meta.bindings;

	if (!bindings.has(property))
		bindings.set(property, new Set());

	bindings.get(property).add(element);
}