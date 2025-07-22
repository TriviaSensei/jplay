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
let game;
const startGame = (type, data) => {
	if (type === 'local') {
		uid = localStorage.getItem('jp-client-id');
		game = new Game(data, { uid, key: 'ArrowDown' }, null, sh);
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
const removePlayer = document.querySelector('#remove-player');
const confirmEditPlayer = document.querySelector('#confirm-edit-player');
const playerSettingsModal = new bootstrap.Modal('#player-settings-modal');
const pi = document.querySelector('#player-index');
const playerName = document.querySelector('#set-player-name');
const setKeyButton = document.querySelector('#set-button');
const buzzerKey = document.querySelector('#current-key');
const startGameModal = new bootstrap.Modal('#start-game-modal');
const confirmStartGame = document.querySelector('#confirm-start');

const gameBoard = gameContainer.querySelector('.game-board');
const gameHeaders = getElementArray(gameBoard, '.category-box');

const categoryScroll = gameContainer.querySelector(
	'.category-scroll-container'
);
const categoryScrollInner = categoryScroll.querySelector('.category-scroll');
const categoryDisplays = getElementArray(categoryScroll, '.category-box');

const liveClue = gameContainer.querySelector('.live-clue-display');
const clueBoxes = getElementArray(gameContainer, '.clue-box');
const clueValues = getElementArray(gameContainer, '.clue-value');

const sideLights = getElementArray(liveClue, '.side-light');
const liveClueText = liveClue.querySelector('.clue-text');
const liveClueCategory = liveClue.querySelector('.category-text');
const liveValue = liveClue.querySelector('.value-text');
let liveClueData;

const lecterns = getElementArray(gameContainer, '.lectern');

const timeoutSound = document.querySelector('#timeout-sound');

const hidePanel = (tgt) => {
	tgt.classList.add('d-none');
};
const showPanel = (tgt) => tgt.classList.remove('d-none');

const getPlayerIndex = () => {
	return Number(pi.getAttribute('value'));
};

const sendGameInput = (...args) => {
	if (!game) return;
	try {
		game.handleInput(...args);
	} catch (err) {
		showMessage('error', err.message);
	}
};

//handle key press
document.addEventListener('keydown', (e) => {
	const setKey = setKeyButton.getAttribute('data-toggled') === 'true';
	const state = sh.getState();

	if (!state) return;
	if (setKey && !state.active) {
		setKeyButton.blur();
		const playerIndex = getPlayerIndex();
		if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 2) return;
		//no two local players can have the same key
		if (
			!state.players.every((p, i) => {
				if (p.isRemote) return true;
				return p.key !== e.key || i === playerIndex;
			}) ||
			(!state.players[playerIndex].isRemote && e.key === state.host.key)
		) {
			showMessage('warning', `Duplicated buzzer key - no changes made`);
		} else if (
			!state.players[playerIndex].isRemote &&
			['C', 'X'].includes(e.key.toUpperCase())
		) {
			return showMessage('error', 'Key is reserved for host functionality');
		} else {
			state.players[playerIndex].key = e.key;
			buzzerKey.setAttribute('data-key', e.key);
			sh.setState(state);
		}
		setKeyButton.setAttribute('data-toggled', 'false');
		setKeyButton.innerHTML = 'Set key';
		return;
	} else if (!state.active && e.key === state.host.key) {
		if (state.players.some((p) => p.name)) startGameModal.show();
		else
			return showMessage('error', 'You must have at least one active player');
	} else if (state.active) {
		if (
			[state.host.key.toLowerCase(), 'c', 'x'].includes(e.key.toLowerCase())
		) {
			if (uid !== state.host.uid) return;
			if (e.key === state.host.key) sendGameInput('host');
			else if (e.key.toLowerCase() === 'c') sendGameInput('correct');
			else if (e.key.toLowerCase() === 'x') sendGameInput('incorrect');
		} else {
			const ind = state.players.findIndex(
				(p) => e.key === p.key && p.name !== ''
			);
			if (ind < 0) return;
			sendGameInput('player', ind);
		}
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

		if (!e.detail) e.target.setAttribute('data-round', 0);
		else e.target.setAttribute('data-round', Math.max(0, e.detail.round) + 1);
	});

	const loadPlayerData = (e) => {
		const state = sh.getState();
		if (state.state !== 'pregame') return;

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
			if (e.detail.state !== 'pregame') return e.target.classList.add('d-none');
			else e.target.classList.remove('d-none');

			const ep = e.target.closest('.edit-player');
			if (ep && e.detail.players[i]?.name) ep?.classList.add('d-none');
			else ep?.classList.remove('d-none');
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

		game.gameState.players[index].setName(playerName.value);
		game.gameState.players[index].setKey(key);
		game.updateGameState();

		pi.removeAttribute('value');

		playerSettingsModal.hide();
	});

	cancelEditPlayer.addEventListener('click', () => {
		pi.removeAttribute('value');
		playerName.value = '';
		buzzerKey.innerHTML = '[None]';
	});

	removePlayer.addEventListener('click', () => {
		const index = getPlayerIndex();
		const state = sh.getState();
		if (!state || state.state !== 'pregame') return;
		game.resetPlayer(index);
		playerSettingsModal.hide();
	});

	confirmStartGame.addEventListener('click', () => {
		sendGameInput('start');
		startGameModal.hide();
	});

	sh.addWatcher(buzzerKey, (e) => {
		if (!e.detail) return;
		const ind = getPlayerIndex();
		let key = e.detail.players[ind].key;

		if (key.charCodeAt(0) === 32) key = 'Space';
		e.target.innerHTML = key;
	});

	sh.addWatcher(null, (state) => {
		if (!state) return;
		[liveClue, categoryScroll, gameBoard].forEach((el) =>
			el.classList.add('d-none')
		);
		if (state.selectedClue[0] !== -1 && state.selectedClue[1] !== -1) {
			liveClue.classList.remove('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.add('d-none');
			const [cat, row] = state.selectedClue;
			if (cat === -1 || row === -1) return;
			const liveCategory = state.board[state.round][cat];
			liveClueData = liveCategory.clues[row];
			liveClueText.innerHTML = liveClueData.text;
			liveValue.innerHTML = `$${liveClueData.value}`;
			liveClueCategory.innerHTML = liveCategory.category;
		} else if (state.state === 'boardIntro' && state.categoryShown >= 0) {
			liveClue.classList.add('d-none');
			gameBoard.classList.add('d-none');
			categoryScroll.classList.remove('d-none');
			categoryDisplays.forEach((cb, i) => {
				const ind = Number(cb.getAttribute('data-col'));
				if (ind > state.categoryShown) cb.classList.add(`category-hidden`);
				else if (ind === state.categoryShown) {
					categoryScrollInner.style.left = `-${100 * state.categoryShown}%`;
					setTimeout(() => cb.classList.remove('category-hidden'), 500);
					const cd = cb.querySelector('.category-div');
					cd.innerHTML = state.board[state.round][i].category;
				}
			});
		} else if (state.state === 'select') {
			liveClue.classList.add('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.remove('d-none');
			gameHeaders.forEach((g, i) => {
				g.classList.remove('category-hidden');
				const cd = g.querySelector('.category-div');
				cd.innerHTML = state.board[state.round][i].category;
			});
		} else {
			liveClue.classList.add('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.remove('d-none');
		}
	});

	clueValues.forEach((cb) => {
		const cat = Number(cb.getAttribute('data-category'));
		const row = Number(cb.getAttribute('data-row'));
		if (isNaN(cat) || isNaN(row)) return;
		sh.addWatcher(cb, (e) => {
			const state = e.detail;
			if (!state) return;
			if (state.round >= state.board.length - 1 || state.round < 0) return;
			if (state.board[state.round][cat].clues[row].selected)
				e.target.innerHTML = '';
			else
				e.target.innerHTML = `$${
					state.board[state.round][cat].clues[row].value
				}`;
		});
	});

	lecterns.forEach((l) =>
		sh.addWatcher(l, (e) => {
			if (!e.detail) return;
			if (e.detail.control === Number(l.getAttribute('data-index')))
				e.target.classList.add('control');
			else e.target.classList.remove('control');
		})
	);

	clueBoxes.forEach((cb) => {
		cb.addEventListener('click', (e) => {
			const state = sh.getState();
			if (state?.state !== 'select') return;
			const cat = Number(e.target.getAttribute('data-category'));
			const row = Number(e.target.getAttribute('data-row'));
			sendGameInput('clue', cat, row);
		});
	});

	sh.addWatcher(liveClue, (e) => {
		if (e?.detail?.state === 'clueLive') e.target.classList.add('live');
		else e.target.classList.remove('live');
	});

	sh.addWatcher(null, (state) => {
		if (state?.message?.trim()) showMessage('info', state.message);
		if (state?.isRemote) emit('update-game-state', state, 1500);
		if (state) document.body.classList.add('dark');
		else document.body.classList.remove('dark');
	});

	sh.addWatcher(timeoutSound, (e) => {
		if (!e.detail) return;
		else if (e.detail.timeout && e.detail.playSound) {
			e.target.play();
			console.log(e.detail);
		}
	});
});
