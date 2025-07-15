import { getElementArray } from './utils/getElementArray.js';
import { showMessage } from './utils/messages.js';
import { handleRequest } from './utils/requestHandler.js';
import { StateHandler } from './utils/stateHandler.js';
import { withTimeout } from './utils/socketTimeout.js';
const createButton = document.querySelector('#create-game');
const fileUpload = document.querySelector('#game-file');

const emit = (eventName, data, timeout) => {
	const evt = new CustomEvent('emit-event', {
		detail: {
			eventName,
			data,
			timeout,
		},
	});
	document.dispatchEvent(evt);
};

const sh = new StateHandler(null);
let uid;
const startGame = (type, data) => {
	if (type === 'local') {
		uid = localStorage.getItem('jp-client-id');
		sh.setState(
			new Game(data, { uid, key: 'ArrowDown' }, null, sh).getGameState()
		);
	} else if (type === 'remote') {
		emit(
			'create-game',
			{
				rounds: data,
				uid: localStorage.getItem('jp-client-id'),
			},
			withTimeout(
				(data) => {
					if (data.status !== 'OK') return showMessage('error', data.message);
					sh.setState(data.gameState);
					console.log(sh.getState());
				},
				() => {
					showMessage('error', `Request timed out - try again later`);
				}
			)
		);
	}
};

const initContainer = document.querySelector('.init-container');
const gameContainer = document.querySelector('.game-container');
const editPlayerButtons = getElementArray(document, '.edit-player-button');
const nameDisplays = getElementArray(document, '.name-container');
const cancelEditPlayer = document.querySelector('#cancel-edit-player');
const confirmEditPlayer = document.querySelector('#confirm-edit-player');
const playerSettingsModal = new bootstrap.Modal('#player-settings-modal');
const pi = document.querySelector('#player-index');
const playerName = document.querySelector('#set-player-name');
const setKeyButton = document.querySelector('#set-button');
const buzzerKey = document.querySelector('#current-key');

const hidePanel = (tgt) => {
	tgt.classList.add('d-none');
};
const showPanel = (tgt) => tgt.classList.remove('d-none');

const getPlayerIndex = () => {
	return Number(pi.getAttribute('value'));
};

document.addEventListener('keydown', (e) => {
	const setKey = setKeyButton.getAttribute('data-toggled') === 'true';
	const state = sh.getState();
	if (setKey) {
		setKeyButton.blur();
		const playerIndex = getPlayerIndex();
		if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 2) return;
		//no two local players can have the same key
		if (
			!state.players.every((p, i) => {
				if (p.isRemote) return true;
				return p.key !== e.key || i === playerIndex;
			})
		) {
			showMessage('warning', `Duplicated buzzer key - no changes made`);
		} else {
			state.players[playerIndex].key = e.key;
			buzzerKey.setAttribute('data-key', e.key);
			sh.setState(state);
		}
		setKeyButton.setAttribute('data-toggled', 'false');
		setKeyButton.innerHTML = 'Set key';
		return;
	}
});

document.addEventListener('DOMContentLoaded', () => {
	const files = getElementArray(document, '.file');
	const selectFile = (e) => {
		const sf = document.querySelector('.file.selected');
		if (!e.target || sf === e.target) return;
		if (sf) {
			sf.classList.remove('selected');
			sf.setAttribute('aria-selected', false);
		}
		e.target.classList.add('selected');
		e.target.setAttribute('aria-selected', true);
	};
	files.forEach((f) => f.addEventListener('click', selectFile));

	createButton.addEventListener('click', async () => {
		const gameType = document.querySelector(
			'[name="play-type"]:checked'
		)?.value;
		if (!gameType) return showMessage('error', 'No game type selected');
		else if (gameType !== 'local' && gameType !== 'remote')
			return showMessage('error', 'Invalid game type selected');
		const fileType = document.querySelector(
			'[name="load-type"]:checked'
		)?.value;
		if (!fileType) return showMessage('error', 'File location not specified');
		let data;
		if (fileType === 'local') {
			const file = fileUpload.files[0];
			if (!file) return showMessage('error', 'No file specified');
			else if (file.type !== 'application/json')
				return showMessage('error', 'Invalid file format');
			const reader = new FileReader();
			reader.addEventListener('load', () => {
				data = JSON.parse(reader.result);
				startGame(gameType, data.rounds);
			});
			reader.readAsText(file, 'utf-8');
		} else if (fileType === 'remote') {
			const filename = document
				.querySelector('.file.selected')
				?.getAttribute('data-file');
			if (!filename) return showMessage('error', 'No file selected');
			const handler = (res) => {
				if (res.status === 'success') data = res.data.rounds;
				else return showMessage('error', res.message);
				startGame(gameType, data);
			};
			const url = `/games/${filename}`;
			showMessage('info', 'Starting game...');
			handleRequest(url, 'GET', null, handler);
		} else return showMessage('error', 'Invalid file location specified');
	});

	sh.addWatcher(initContainer, (e) => {
		if (e.detail) hidePanel(e.target);
		else showPanel(e.target);
	});

	sh.addWatcher(gameContainer, (e) => {
		if (!e.detail || e.detail.host.uid !== uid) hidePanel(e.target);
		else showPanel(e.target);
	});

	const loadPlayerData = (e) => {
		const lec = e.target.closest('.lectern');
		if (!lec) return;
		const playerIndex = Number(lec.getAttribute('data-index'));
		if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 2) return;
		pi.setAttribute('value', lec.getAttribute('data-index'));
		const gameState = sh.getState();
		playerName.value = gameState.players[playerIndex].getName() || '';
		let key = gameState.players[playerIndex].key || '[None]';
		if (key.length === 1 && key.charCodeAt(0) === 32) key = 'Space';
		buzzerKey.setAttribute('data-key', key);
		buzzerKey.innerHTML = key;
		playerSettingsModal.show();
	};
	editPlayerButtons.forEach((b, i) => {
		b.addEventListener('click', loadPlayerData);
		sh.addWatcher(b, (e) => {
			if (!e.detail) return;
			const ep = e.target.closest('.edit-player');
			if (ep && e.detail.players[i]?.name)
				e.target.closest('.edit-player')?.classList.add('d-none');
		});
	});
	nameDisplays.forEach((nd, i) => {
		nd.addEventListener('click', loadPlayerData);
		sh.addWatcher(nd, (e) => {
			if (!e.detail) return;
			if (e.detail.players[i]?.name) {
				e.target.classList.remove('d-none');
				e.target.innerHTML = e.detail.players[i].name;
			} else e.target.classList.add('d-none');
		});
	});

	setKeyButton.addEventListener('click', (e) => {
		const curr = e.target.getAttribute('data-toggled');
		e.target.setAttribute('data-toggled', curr === 'false' ? 'true' : 'false');
		e.target.innerHTML = curr === 'false' ? '[Press a key]' : 'Set key';
	});

	confirmEditPlayer.addEventListener('click', () => {
		const index = getPlayerIndex();
		const state = sh.getState();
		if (isNaN(index) || index < 0 || index >= state.players.length)
			return pi.removeAttribute('value');

		const lec = document.querySelector(`.lectern[data-index="${index}"]`);
		if (!lec) return pi.removeAttribute('value');

		const key = buzzerKey.getAttribute('data-key');

		state.players[index].name = playerName.value;
		state.players[index].key = key;
		sh.setState(state);

		pi.removeAttribute('value');

		playerSettingsModal.hide();
	});

	cancelEditPlayer.addEventListener('click', () => {
		pi.removeAttribute('value');
		playerName.value = '';
		buzzerKey.innerHTML = '[None]';
	});

	sh.addWatcher(buzzerKey, (e) => {
		if (!e.detail) return;
		const ind = getPlayerIndex();
		let key = e.detail.players[ind].key;
		if (key.charCodeAt(0) === 32) key = 'Space';
		e.target.innerHTML = key;
	});

	sh.addWatcher(null, (state) => {
		if (state?.isRemote) emit('update-game-state', state, 1500);
	});
});
