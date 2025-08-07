import { getElementArray } from './utils/getElementArray.js';
import { showMessage } from './utils/messages.js';
import { handleRequest } from './utils/requestHandler.js';
import { withTimeout } from './utils/socketTimeout.js';
const createButton = document.querySelector('#create-game');
const fileUpload = document.querySelector('#game-file');

const isKey = location.href.indexOf('control') >= 0;

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
		game = new Game(
			data,
			{ uid, keys: ['arrowdown', 'space', 'spacebar'] },
			null,
			sh
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
const playerSettingsModal = document.querySelector('#player-settings-modal')
	? new bootstrap.Modal('#player-settings-modal')
	: null;
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

const ddDiv = document.querySelector('.dd-div');

const sideLights = getElementArray(liveClue, '.side-light');
const liveClueText = liveClue.querySelector('.clue-text');
const liveClueCategory = liveClue.querySelector('.category-text');
const liveValue = liveClue.querySelector('.value-text');
const liveResponse = isKey ? liveClue.querySelector('.response-text') : null;
let liveClueData;

const lecterns = getElementArray(gameContainer, '.lectern');
const scoreDisplays = getElementArray(gameContainer, '.lectern .score');

const timeoutSound = document.querySelector('#timeout-sound');
const ddSound = document.querySelector('#dd-sound');
const ddw = document.querySelector('#dd-wager-modal');
const ddWagerModal = isKey ? new bootstrap.Modal(ddw) : null;
let ddPlayerName, ddWager, maxWager, confirmDDWager;
if (ddWagerModal) {
	ddPlayerName = ddw.querySelector('#dd-player-name');
	ddWager = ddw.querySelector('#dd-wager');
	maxWager = ddw.querySelector('#dd-range');
	confirmDDWager = ddw.querySelector('#confirm-dd-wager');
}
const hidePanel = (tgt) => {
	tgt.classList.add('d-none');
};
const showPanel = (tgt) => tgt.classList.remove('d-none');

const getPlayerIndex = () => {
	return Number(pi.getAttribute('value'));
};

const sendGameInput = (...args) => {
	if (isKey) {
		const evt = new CustomEvent('receive-input', {
			detail: {
				args,
			},
		});
		if (!window.opener) return;
		return window.opener.document.dispatchEvent(evt);
	} else if (!game) return;
	try {
		game.handleInput(...args);
	} catch (err) {
		showMessage('error', err.message);
	}
};

let keyWindow;
//send game state to key window - called when key window is opened, or when
//state is updated
const sendGameState = () => {
	if (isKey) return;
	const state = sh.getState();
	const evt = new CustomEvent('receive-state', { detail: state });
	if (keyWindow?.document) keyWindow.document.dispatchEvent(evt);
};
//receive the game state from the main window
const receiveGameState = (e) => {
	sh.setState(e.detail);
};
if (isKey) document.addEventListener('receive-state', receiveGameState);

//open key
const openKey = () => {
	if (keyWindow) keyWindow.close();
	keyWindow = window.open(
		`/control`,
		'_blank',
		`popup,menubar=false,statusbar=no,toolbar=false,location=false,scrollbars=false`
	);
	keyWindow.addEventListener('load', sendGameState, { once: true });
};

//handle key press
const handleKeyPress = async (e) => {
	const setKey = setKeyButton.getAttribute('data-toggled') === 'true';
	const state = sh.getState();
	if (!state) return;

	//open up key window
	if (e.key.toLowerCase() === 'k' && uid === state.host.uid && !isKey)
		return openKey();

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
			})
		) {
			showMessage('warning', `Duplicated buzzer key - no changes made`);
		} else if (
			!state.players[playerIndex].isRemote &&
			state.host.keys.includes(e.key.toLowerCase())
		) {
			showMessage('warning', `Key is reserved for host - no changes made`);
		} else if (
			!state.players[playerIndex].isRemote &&
			['C', 'X'].includes(e.key.toUpperCase())
		) {
			showMessage('warning', `Key is reserved for host - no changes made`);
		} else {
			state.players[playerIndex].key = e.key;
			buzzerKey.setAttribute('data-key', e.key);
			sh.setState(state);
		}
		setKeyButton.setAttribute('data-toggled', 'false');
		setKeyButton.innerHTML = 'Set key';
		return;
	} else if (!state.active && state.host.keys.includes(e.key.toLowerCase())) {
		if (state.players.some((p) => p.name)) startGameModal.show();
		else
			return showMessage('error', 'You must have at least one active player');
	} else if (state.active) {
		if ([...state.host.keys, 'c', 'x', 'k'].includes(e.key.toLowerCase())) {
			if (uid !== state.host.uid) return;
			if (state.host.keys.includes(e.key.toLowerCase())) sendGameInput('host');
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
};
const sendKey = (e) => {
	const key = e.key;
	if (!window.opener) return;
	const evt = new CustomEvent('receive-key', { detail: { key } });
	window.opener.document.dispatchEvent(evt);
};
//main game - handle key press on keydown, receive key from control window
if (!isKey) {
	document.addEventListener('keydown', handleKeyPress);
	document.addEventListener('receive-key', (e) => {
		handleKeyPress({ key: e.detail.key });
	});
	document.addEventListener('receive-input', (e) => {
		const { args } = e.detail;
		console.log(args);
		if (game) game.handleInput(...args);
	});
}
//control window - on key press, send it to the main window to manage the state
else {
	document.addEventListener('keydown', sendKey);
}

document.addEventListener('DOMContentLoaded', () => {
	if (isKey && !window.opener) location.href = '/';

	const files = getElementArray(document, '.file');
	if (files) {
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
	}

	if (createButton)
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
		if (!e?.detail) return;
		if (e.detail) hidePanel(e.target);
		else showPanel(e.target);
	});

	sh.addWatcher(gameContainer, (e) => {
		if (isKey) showPanel(e.target);
		else if (!e.detail || e.detail.host.uid !== uid) hidePanel(e.target);
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

	if (setKeyButton)
		setKeyButton.addEventListener('click', (e) => {
			const curr = e.target.getAttribute('data-toggled');
			e.target.setAttribute(
				'data-toggled',
				curr === 'false' ? 'true' : 'false'
			);
			e.target.innerHTML = curr === 'false' ? '[Press a key]' : 'Set key';
		});

	if (confirmEditPlayer)
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

	if (cancelEditPlayer)
		cancelEditPlayer.addEventListener('click', () => {
			pi.removeAttribute('value');
			playerName.value = '';
			buzzerKey.innerHTML = '[None]';
		});

	if (removePlayer)
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

	const getCategory = (cat) => {
		const state = sh.getState();
		if (!state) return null;
		else if (Array.isArray(state.board[state.round]))
			return state.board[state.round][cat];
		else if (state.round === state.board.length - 1)
			return state.board[state.round];
	};
	const getClue = (cat, row) => {
		const state = sh.getState();
		if (!state) return null;
		else if (Array.isArray(state.board[state.round]))
			return state.board[state.round][cat].clues[row];
		else if (state.round === state.board.length - 1)
			return state.board[state.round];
	};

	//main screen display as function of state
	sh.addWatcher(null, (state) => {
		if (!state) return;
		[liveClue, categoryScroll, gameBoard].forEach((el) =>
			el.classList.add('d-none')
		);

		if (state.state === 'waitingDD') {
			//waiting for a DD wager
			liveClue.classList.add('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.remove('d-none');
			//play the sound
			if (!isKey && ddSound && state.playSound) {
				ddSound.play();
			} else if (isKey) {
				//set up and show the dd wager modal
				const round = state.round;
				const minMaxWager = (round + 1) * 1000;
				const player = state.players[state.control];
				if (!player) return;
				maxWager.innerHTML = Math.max(minMaxWager, player.getScore());

				ddPlayerName.innerHTML = player.getName();

				if (state.playSound && ddWagerModal) {
					setTimeout(() => {
						ddWagerModal.show();
					}, 3000);
				} else if (isKey && ddWagerModal) ddWagerModal.show();
			}

			//show the animation
			if (ddDiv) {
				const [cat, row] = state.selectedClue;
				ddDiv.setAttribute(
					'style',
					`left:${((100 * (cat + 0.5)) / 6).toFixed(3)}%;top:${(
						(100 * (row + 1.5)) /
						6
					).toFixed(3)}%`
				);
				setTimeout(() => {
					ddDiv.classList.add('animation');
				}, 1);
			}
		} else if (state.selectedClue[0] !== -1 && state.selectedClue[1] !== -1) {
			const [cat, row] = state.selectedClue;
			if (cat === -1 || row === -1) return;
			liveClue.classList.remove('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.add('d-none');
			const liveCategory = getCategory(cat);
			liveClueData = liveCategory.clues[row];
			liveClueText.innerHTML = liveClueData.text;
			liveValue.innerHTML =
				state.state === 'showDD' || state.state === 'DDLive'
					? `DD: $${state.wager}`
					: `$${liveClueData.value}`;
			liveClueCategory.innerHTML = liveCategory.category;
			if (isKey && liveResponse) liveResponse.innerHTML = liveClueData.response;
		} else if (state.state === 'boardIntro' && state.categoryShown >= -1) {
			liveClue.classList.add('d-none');
			gameBoard.classList.add('d-none');
			categoryScroll.classList.remove('d-none');
			categoryDisplays.forEach((cb, i) => {
				const ind = Number(cb.getAttribute('data-col'));
				if (ind > state.categoryShown) cb.classList.add(`category-hidden`);
				else if (ind === state.categoryShown) {
					setTimeout(() => cb.classList.remove('category-hidden'), 500);
					const cd = cb.querySelector('.category-div');
					cd.innerHTML = getCategory(i)?.category || '';
				}
			});
			categoryScrollInner.style.left = `${-100 * state.categoryShown}%`;
		} else if (state.state === 'select') {
			liveClue.classList.add('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.remove('d-none');

			gameHeaders.forEach((g, i) => {
				g.classList.remove('category-hidden');
				const cd = g.querySelector('.category-div');
				cd.innerHTML = getCategory(i)?.category || '';
			});
		} else {
			liveClue.classList.add('d-none');
			categoryScroll.classList.add('d-none');
			gameBoard.classList.remove('d-none');
		}
	});

	const getCatRow = (cb) => {
		const cat = Number(cb.getAttribute('data-category'));
		const row = Number(cb.getAttribute('data-row'));
		return [cat, row];
	};
	clueValues.forEach((cb) => {
		const [cat, row] = getCatRow(cb);
		if (isNaN(cat) || isNaN(row)) return;
		sh.addWatcher(cb, (e) => {
			const state = e.detail;
			if (!state) return;
			if (state.round >= state.board.length - 1 || state.round < 0) return;
			const clue = getClue(cat, row);
			if (!clue) return;
			if (clue.selected) e.target.innerHTML = '';
			else e.target.innerHTML = `$${clue.value}`;
		});
	});

	let timerTimeout = null;
	let timerInterval = null;

	const tickLights = (lec) => {
		const t = Number(lec.getAttribute('data-time'));
		if (!t || t === 0) lec.removeAttribute('data-time');
		else lec.setAttribute('data-time', t - 1);
	};

	const stopTimerLights = () => {
		if (timerTimeout) clearTimeout(timerTimeout);
		timerTimeout = null;
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
		const current = gameContainer.querySelector('.lectern.lit');
		if (current) {
			current.classList.remove('lit');
			current.removeAttribute('data-time');
		}
	};
	const startTimerLights = (lec, elapsed) => {
		//turn off the other timer lights if needed
		if (timerTimeout) clearTimeout(timerTimeout);
		timerTimeout = null;
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
		const lit = getElementArray(gameContainer, '.lectern.lit');
		lit.forEach((l) => {
			if (l !== lec) l.classList.remove('lit');
		});
		//set it to 5 seconds
		const timeLeft = 4000 - elapsed;
		const secondsLeft = Math.min(4, Math.floor(timeLeft / 1000));
		const residual = timeLeft - secondsLeft * 1000;
		lec.setAttribute('data-time', secondsLeft);
		timerTimeout = setTimeout(() => {
			timerInterval = setInterval(() => {
				tickLights(lec);
			}, 1000);
		}, residual);
	};
	lecterns.forEach((l) =>
		sh.addWatcher(l, (e) => {
			if (!e.detail) return;
			const ind = Number(l.getAttribute('data-index'));
			if (e.detail.control === ind) e.target.classList.add('control');
			else e.target.classList.remove('control');
			if (e.detail.buzzedIn === ind && e.detail.state === 'buzz') {
				e.target.classList.add('lit');
				startTimerLights(l, e.detail.currentTime - e.detail.buzzTime);
			} else e.target.classList.remove('lit');
		})
	);

	const selectClue = (e) => {
		const [cat, row] = getCatRow(e.target);
		const state = sh.getState();
		if (state?.state !== 'select') return;
		sendGameInput('clue', cat, row);
	};
	clueBoxes.forEach((cb) => cb.addEventListener('click', selectClue));

	sh.addWatcher(liveClue, (e) => {
		if (e?.detail?.state === 'clueLive' || e?.detail?.state === 'DDLive')
			e.target.classList.add('live');
		else e.target.classList.remove('live');
	});

	scoreDisplays.forEach((sd, i) => {
		sh.addWatcher(sd, (e) => {
			if (!e.detail) return;
			const score = e.detail.players[i]?.getScore() || 0;
			if (score >= 0) e.target.classList.remove('neg');
			else e.target.classList.add('neg');

			e.target.innerHTML = `$${Math.abs(score)}`;
		});
	});

	if (ddDiv)
		sh.addWatcher(ddDiv, (e) => {
			if (e.detail.state !== 'waitingDD')
				e.target.classList.remove('animation');
		});

	sh.addWatcher(null, (state) => {
		if (state?.message?.trim()) showMessage('info', state.message);
		if (state?.isRemote) emit('update-game-state', state, 1500);
		if (state) document.body.classList.add('dark');
		else document.body.classList.remove('dark');
	});

	sh.addWatcher(timeoutSound, (e) => {
		if (!e.detail) return;
		else if (!isKey && e.detail.timeout && e.detail.playSound) e.target.play();
	});

	if (!isKey)
		sh.addWatcher(
			null,
			(state) => {
				if (state && !keyWindow) openKey();
			},
			{ once: true }
		);

	//send game state to key window on state update
	if (!isKey) sh.addWatcher(null, sendGameState);
	else
		sh.addWatcher(null, (state) => {
			if (!state) return;
			if (!Array.isArray(state.board[state.round])) return;

			clueBoxes.forEach((cb) => {
				const [cat, row] = getCatRow(cb);
				const clue = getClue(cat, row);
				if (clue.dailyDouble && !clue.selected) cb.classList.add('dd');
				else cb.classList.remove('dd');
			});
		});

	if (confirmDDWager)
		confirmDDWager.addEventListener('click', () => {
			const state = sh.getState();
			if (state.state !== 'waitingDD')
				return showMessage('error', 'Invalid state');
			const wager = Number(ddWager.value);
			if (wager < 5)
				return showMessage('error', 'Invalid wager - minimum wager is $5');
			const player = state.players[state.control];
			if (!player) return showMessage('error', 'Invalid state');
			const maxWager = Math.max(player.getScore(), (state.round + 1) * 1000);
			if (wager > maxWager)
				return showMessage(
					'error',
					`Invalid wager - maximum wager is $${maxWager}`
				);
			try {
				sendGameInput('setWager', wager);
				ddWagerModal.hide();
			} catch (err) {
				showMessage('error', err.message);
			}
		});
});
