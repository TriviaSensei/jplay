const checkEqual = (a, b) => {
	if (a === b) {
		return true;
	} else if (typeof a !== typeof b) return false;
	else if ((typeof a).toLowerCase() !== 'object') return false;

	if (Array.isArray(a)) {
		if (!Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		return a.every((el, i) => checkEqual(el, b[i]));
	} else {
		const keys = Object.getOwnPropertyNames(a);
		return keys.every((k) => {
			return checkEqual(a[k], b[k]);
		});
	}
};

class StateHandler {
	randomString(length) {
		const chars =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		const randomArray = new Uint8Array(length);
		crypto.getRandomValues(randomArray);
		randomArray.forEach((number) => {
			result += chars[number % chars.length];
		});
		return result;
	}

	constructor(initialState, ...validator) {
		if ((typeof initialState).toLowerCase() === 'function')
			throw new Error('State cannot be set to a function');

		this.state = { value: initialState };

		if (validator) {
			this.validator = validator[0];
		}
		this.id = this.randomString(20);
		this.objects = [];
	}

	validateState(state) {
		return this.validator(state);
	}

	addWatcher(obj, updater, ...settings) {
		if (
			obj &&
			this.objects.some((o) => {
				return o.node === obj;
			})
		) {
			console.log(obj);
			throw new Error(`Object is already added to this state handler.`);
		} else if (obj && (!obj.nodeType || obj.nodeType !== Node.ELEMENT_NODE))
			throw new Error(`Object ${obj.toString()} is not a valid node`);
		else if (updater.length > 2)
			throw new Error(`Updater function can take a maximum of 2 arguments.`);
		else if (obj && updater.length > 1)
			throw new Error(
				`Updater function can take up to 1 argument with non-null object.`
			);
		let inputSettings = settings.length === 1 ? settings[0] : null;
		if (settings.length > 0) console.log(inputSettings);
		if (inputSettings?.checkDiff) {
			console.log(obj);
		}
		this.objects.push({
			node: obj,
			updater,
			checkDiff: inputSettings?.checkDiff || null,
		});
		if (obj) {
			obj.addEventListener(`update-state-${this.id}`, updater, {
				once: inputSettings?.once === true,
			});
			updater({ target: obj, detail: this.state.value });
		} else {
			if (updater.length === 1) updater(this.state.value);
			else if (updater.length === 2) {
				updater(null, this.state.value);
			}
		}
	}

	removeWatcher(obj) {
		if (!obj) return;
		else if (obj.nodeType && obj.nodeType === Node.ELEMENT_NODE)
			this.objects = this.objects.filter((o) => {
				return o !== obj;
			});
		else if ((typeof obj).toLowerCase() === 'function') {
			this.objects = this.objects.filter((o) => {
				return o.updater !== obj;
			});
		}
	}

	setState(s, ...opts) {
		console.log('SH setting state');
		console.log(s);
		const oldState = {
			...this.state,
		};
		if ((typeof s).toLowerCase() === 'function') {
			if (this.validator && !this.validateState(s(this.state.value)))
				throw new Error('State is invalid');
			this.state.value = s(this.state.value);
		} else {
			if (this.validator && !this.validateState(s))
				throw new Error('State is invalid');
			this.state.value = s;
		}

		if (opts.length > 0) {
			if (opts[0].runUpdates === false) return;
		}

		const evt = new CustomEvent(`update-state-${this.id}`, {
			detail: this.state.value,
		});
		this.objects.forEach((o) => {
			if (o.node) {
				if (!document.body.contains(o.node)) return this.removeWatcher(o);
				else {
					if (o.checkDiff) {
						console.log('checking diff');
						const a = o.checkDiff(oldState.value);
						const b = o.checkDiff(this.getState());
						console.log(a, b);
						if (checkEqual(a, b)) return;
					}
				}
				o.node.dispatchEvent(evt);
			} else {
				if (o.checkDiff) {
					console.log('checking diff');
					const a = o.checkDiff(oldState.value);
					const b = o.checkDiff(this.getState());
					console.log(a, b);
					if (checkEqual(a, b)) return;
				}

				if (o.updater.length === 0) o.updater();
				if (o.updater.length === 1) o.updater(this.getState());
				else if (o.updater.length === 2)
					o.updater(oldState.value, this.getState());
			}
		});
	}

	getState() {
		if (!this.state) return null;
		else return this.state.value;
	}

	refreshState() {
		this.setState(this.state.value);
	}
}
