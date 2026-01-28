import { getElementArray } from './utils/getElementArray.js';
import { showMessage } from './utils/messages.js';
import { handleRequest } from './utils/requestHandler.js';
import { withTimeout } from './utils/socketTimeout.js';
import { createElement } from './utils/createElementFromSelector.js';

const createButton = document.querySelector('#create-game');
const fileUpload = document.querySelector('#game-file');
let socket;
const lsItem = 'jp-client-id';
const hostKeys = ['arrowdown', 'space', 'spacebar', ' '];
const isKey = location.href.indexOf('control') >= 0;
let uid;

let isMobile = false;
document.addEventListener(
	'touchstart',
	() => {
		isMobile = true;
	},
	{ once: true, passive: true },
);

const coverDiv = document.querySelector('#cover-div');
if (coverDiv) {
	const skb = coverDiv.querySelector('#show-key-button');
	skb.addEventListener(
		'click',
		() => {
			coverDiv.remove();
		},
		{ once: true },
	);
}

const sh = new StateHandler(null);
const csh = new StateHandler({
	paths: [],
	mouseDown: false,
});

const granularity = 1;

let game;

const retrieveClientId = () => {
	let toReturn;
	toReturn = localStorage.getItem(lsItem);
	if (toReturn) return toReturn;

	toReturn = document.cookie
		.split(';')
		.find((row) => row.startsWith(`${lsItem}=`))
		?.split('=')[1];

	return toReturn;
};

const setClientId = (id) => {
	if (id) {
		localStorage.setItem(lsItem, id);
		document.cookie = `${lsItem}=${id}`;
	}
};

const startGame = (type, data) => {
	retrieveClientId();
	if (type === 'local') {
		uid = retrieveClientId();
		const env =
			location.href.indexOf('j-play') >= 0 ? 'production' : 'development';
		game = new Game(data, { uid, keys: hostKeys }, null, null, sh, env);
	} else if (type === 'remote') {
		uid = retrieveClientId();
		socket.emit(
			'create-game',
			{
				rounds: data,
				uid,
				hostKeys,
			},
			withTimeout(
				(data) => {
					if (data.status !== 'OK') return showMessage('error', data.message);
					sh.setState(data.gameState);
				},
				() => {
					showMessage('error', `Request timed out - try again later`);
				},
			),
		);
	}
};

const initContainer = document.querySelector('.init-container');
const loadType = getElementArray(
	document,
	'input[type="radio"][name="load-type"]',
);
let currentFile;
const gameMetadata = document.querySelector('.game-metadata');
const gameContainer = document.querySelector('.game-container');
const editPlayerButtons = getElementArray(document, '.edit-player-button');
const nameDisplays = getElementArray(document, '.name-container');
const svgDisplays = getElementArray(document, '.lectern-name-canvas');
const cancelEditPlayer = document.querySelector('#cancel-edit-player');
const removePlayer = document.querySelector('#remove-player');
const confirmEditPlayer = document.querySelector('#confirm-edit-player');
const psm = document.querySelector('#player-settings-modal');
const playerSettingsModal = psm ? new bootstrap.Modal(psm) : null;
const pi = document.querySelector('#player-index');
const playerName = document.querySelector('#set-player-name');
const setKeyButton = document.querySelector('#set-button');
const buzzerKey = document.querySelector('#current-key');
const startGameModal = isKey ? null : new bootstrap.Modal('#start-game-modal');
const cancelGame = document.querySelector('#confirm-cancel');
const joinGameButton = document.querySelector('#join-game');
const spectateGame = document.querySelector('#spectate-game');
const newPlayerName = document.querySelector('#player-name');
const joinCode = document.querySelector('#room-code');
const playerContainer = document.querySelector('.player-container');
const egm = document.querySelector('#end-game-modal');

const endGameMessage = egm?.querySelector('#end-game-result');
const ackEndGame = egm?.querySelector('#end-game-ok');
const endGameModal = egm ? new bootstrap.Modal(egm) : null;
const confirmStartGame = document.querySelector('#confirm-start');

const gameBoard = gameContainer.querySelector('.game-board');
const gameHeaders = getElementArray(gameBoard, '.category-box');

const categoryScroll = gameContainer.querySelector(
	'.category-scroll-container',
);
const categoryScrollInner = categoryScroll.querySelector('.category-scroll');
const categoryDisplays = getElementArray(categoryScroll, '.category-box');
const categoryLarge = document.querySelector('.category-large');

const liveClue = gameContainer.querySelector('.live-clue-display');
const clueBoxes = getElementArray(gameContainer, '.clue-box');
const clueValues = getElementArray(
	gameContainer,
	'.clue-value:not(.clue-value-flash)',
);

const ddDiv = document.querySelector('.dd-div');

const sideLights = getElementArray(liveClue, '.side-light');
const liveClueText = liveClue.querySelector('.clue-text');
const liveClueImage = liveClue.querySelector('#clue-image');
const liveClueValue = liveClue.querySelector('.clue-value-flash');

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

let editPlayerModal,
	editPlayerHeader,
	editPlayerName,
	editPlayerScore,
	assignControl;
if (isKey) {
	editPlayerModal = new bootstrap.Modal('#edit-player-modal');
	editPlayerHeader = document.querySelector('#edit-player-header');
	editPlayerName = document.querySelector('#edit-player-name');
	editPlayerScore = document.querySelector('#edit-player-score');
	assignControl = document.querySelector('#give-control');
}

const nameCanvas = document.querySelector('#draw-player-name .name-canvas');
const namePath = document.querySelector('#name-path');
const undoStroke = document.querySelector('#undo-stroke');
const clearStroke = document.querySelector('#clear-stroke');

const fjCategory = document.querySelector('.fj-category');
const fjSound = document.querySelector('#fj-reveal-sound');

const fjResponseDiv = document.querySelector('.fj-response-div');
const fjResponseDisplay = fjResponseDiv.querySelector(
	'.fj-response-display > .display-inner',
);
const fjWagerDisplay = fjResponseDiv.querySelector(
	'.fj-wager-display > .display-inner',
);

const views = [liveClue, categoryScroll, gameBoard, fjCategory, fjResponseDiv];
let fjPrefixDiv = getElementArray(document, 'div.fj-prefix');

let fjw,
	fjr,
	fjWagerModal,
	fjResponseModal,
	confirmFJWagers,
	fjWagerRadios,
	fjWagerLabels,
	fjMaxWagers,
	wagerZero,
	wagerMax,
	fjPrefixes,
	fjResponseLabels,
	fjResponses,
	confirmFJResponses,
	openModalPanel,
	openModal,
	advanceButton,
	correctButton,
	incorrectButton,
	randomizeButton,
	movePlayerPanel,
	movePlayerLabels,
	movePlayerButtons;

if (isKey) {
	fjw = document.querySelector('#fj-wager-modal');
	fjr = document.querySelector('#fj-response-modal');
	fjWagerModal = new bootstrap.Modal(fjw);
	fjResponseModal = new bootstrap.Modal(fjr);
	confirmFJWagers = document.querySelector('#confirm-fj-wager');
	fjWagerLabels = getElementArray(fjw, '.fj-wager-label');
	fjWagerRadios = getElementArray(fjw, 'input[name="fj-wager-radio"]');
	fjMaxWagers = getElementArray(fjw, '.fj-max-wager');
	wagerZero = fjw.querySelector('.wager-0');
	wagerMax = fjw.querySelector('.wager-max');
	fjPrefixes = getElementArray(
		document,
		'.fj-prefix-container input[type="radio"]',
	);
	fjResponseLabels = getElementArray(fjr, 'label.fj-response-label');
	fjResponses = getElementArray(fjr, '.fj-response');
	confirmFJResponses = fjr.querySelector('#confirm-fj-response');
	openModalPanel = document.querySelector('.modal-open');
	openModal = openModalPanel.querySelector('#open-modal');
	advanceButton = document.querySelector('#advance-btn');
	correctButton = document.querySelector('#correct-btn');
	incorrectButton = document.querySelector('#incorrect-btn');
	randomizeButton = document.querySelector('#shuffle-button');
	movePlayerPanel = document.querySelector('#move-player-panel');
	movePlayerLabels = getElementArray(document, 'span.player-order-name');
	movePlayerButtons = getElementArray(document, '.move-player');
}

const socketCB = (fn) =>
	withTimeout(
		(data) => {
			if (data.status !== 'OK') return showMessage('error', data.message);
			const newState = data.gameState;
			if (!newState) return;

			if (data.reset) sh.setState(newState);
			else
				sh.setState((prev) => {
					return {
						...prev,
						...newState,
					};
				});

			if (fn) fn();
		},
		() => {
			console.trace();
			showMessage('error', 'Input timed out');
		},
	);

/*TODO: implement opening this and having user submit their FJ wager and response */
const fjpwm = document.querySelector('#fj-player-wager-modal');
let fjPlayerWagerModal, fjPlayerWager, saveFJWager, fjWagerZero, fjWagerMax;
if (fjpwm) {
	fjPlayerWagerModal = new bootstrap.Modal(fjpwm);
	fjPlayerWager = fjpwm.querySelector('#fj-player-wager');
	saveFJWager = fjpwm.querySelector('#confirm-fj-player-wager');
	fjWagerZero = fjpwm.querySelector('.wager-0');
	fjWagerMax = fjpwm.querySelector('.wager-max');
	const fjWagerSetter = (isMax) => {
		return () => {
			if (!fjPlayerWager) return;
			if (isMax)
				fjPlayerWager.value = Number(fjPlayerWager.getAttribute('max'));
			else fjPlayerWager.value = 0;
		};
	};
	fjWagerZero.addEventListener('click', fjWagerSetter(false));
	fjWagerMax.addEventListener('click', fjWagerSetter(true));
	saveFJWager.addEventListener('click', () => {
		const wager = Number(fjPlayerWager.value);
		if (isNaN(wager)) return showMessage('error', 'Invalid wager');
		else if (wager !== Math.floor(wager))
			return showMessage('error', 'You can only wager a whole number');
		socket.emit(
			'save-fj-wager',
			{ wager },
			withTimeout(
				(data) => {
					if (data.status !== 'OK') showMessage('error', data.message);
					else {
						showMessage('info', 'Wager saved');
						fjPlayerWagerModal.hide();
					}
				},
				() => {
					showMessage('error', 'Request timed out');
				},
			),
		);
	});
}
const fjprm = document.querySelector('#fj-player-response-modal');
let fjPlayerResponseModal,
	clearFJResponse,
	fjPlayerResponse,
	saveFJResponseButton;
const saveFJResponse = (silent) => {
	if (!fjPlayerResponse || !isPlayer()) return;
	socket.emit(
		'save-fj-response',
		{ response: fjPlayerResponse.value },
		withTimeout(
			(data) => {
				if (silent) return;
				if (data.status !== 'OK') showMessage('error', data.message);
				else showMessage('info', 'Response saved');
			},
			() => {
				showMessage('error', 'Request timed out');
			},
		),
	);
};
if (fjprm) {
	fjPlayerResponseModal = new bootstrap.Modal(fjprm);
	fjPlayerResponse = fjprm.querySelector('#fj-player-response');
	clearFJResponse = fjprm.querySelector('#clear-fj-player-response');
	saveFJResponseButton = fjprm.querySelector('#save-fj-player-response');

	clearFJResponse.addEventListener('click', () => {
		fjPlayerResponse.value = '';
	});

	saveFJResponseButton.addEventListener('click', () => saveFJResponse(false));
}

let thinkMusic = document.querySelector('#think-sound');

const hidePanel = (tgt) => {
	if (!tgt) return;
	tgt.classList.add('d-none');
};
const showPanel = (tgt) => (tgt ? tgt.classList.remove('d-none') : null);

const getPlayerIndex = () => {
	return Number(pi.getAttribute('value'));
};

const sendGameInput = (...args) => {
	//if this is the key window, pass the input forward to the main window
	if (isKey) {
		if (!window.opener) return;
		const evt = new CustomEvent('receive-input', {
			detail: {
				args,
			},
		});
		return window.opener.document.dispatchEvent(evt);
	}
	try {
		//if this is a local game, handle the input here
		if (game) game.handleInput(...args);
		//otherwise, send the input to the server
		else socket.emit('game-input', args || [], socketCB());
	} catch (err) {
		showMessage('error', err.message);
	}
};

let keyWindow;
//send game state to key window - called when key window is opened, or when
//state is updated
const sendGameState = (data) => {
	if (isKey) return;
	const evt = new CustomEvent('receive-state', { detail: data });
	if (keyWindow?.document) keyWindow.document.dispatchEvent(evt);
};
//receive the game state from the main window
const receiveGameState = (e) => {
	sh.setState((prev) => {
		return {
			...prev,
			...e.detail,
		};
	});
};
if (isKey) document.addEventListener('receive-state', receiveGameState);
else {
	document.addEventListener('assign-control', (e) => {
		const index = e.detail;
		const state = sh.getState();
		if (!state.players[index]?.name) return;
		const cluesLeft = state.board[state.round].reduce((p, c) => {
			return (
				p +
				c.clues.reduce((p2, c2) => {
					if (c2.selected) return p2;
					return p2 + 1;
				}, 0)
			);
		}, 0);
		const status =
			state.state === 'waitingDD'
				? `Waiting for Daily Double wager from ${state.players[index].name}`
				: `${cluesLeft} clue${cluesLeft === 1 ? '' : 's'} left. ${state.players[index].name} to select a clue`;
		if (state.isRemote) {
			socket.emit(
				'edit-game-data',
				{ gameData: { control: index, status } },
				socketCB(),
			);
		} else {
			game.setGameState({
				control: index,
				status,
			});
		}
	});
}
//open key
const openKey = () => {
	if (isKey) return;
	const openModal = document.querySelector('.modal.show');
	if (openModal) return;
	if (keyWindow) keyWindow.close();
	const windowOptions = `popup,address=false,menubar=false,statusbar=no,status=false,toolbar=false,location=false,scrollbars=false,left=100,top=100,width=1200`;
	keyWindow = window.open(`/control`, 'keyWindow', windowOptions);
	if (!keyWindow)
		showMessage(
			'error',
			'Could not open key - please disable your popup blocker',
			2000,
		);
	else
		keyWindow.addEventListener(
			'load',
			() => {
				const data = sh.getState();
				sendGameState(data);
			},
			{ once: true },
		);
};

const isHost = () => {
	const state = sh.getState();
	if (!state) return false;
	return state.host.uid === uid;
};

const isPlayer = () => {
	const state = sh.getState();
	if (!state) return false;
	return state.players.some((p) => p.uid && p.uid === uid);
};

const isSpectator = () => {
	const state = sh.getState();
	if (!state) return false;
	return !isHost() && !isPlayer();
};

const handleCreateGame = async () => {
	const gameType = document.querySelector('[name="play-type"]:checked')?.value;
	if (!gameType) return showMessage('error', 'No game type selected');
	else if (gameType !== 'local' && gameType !== 'remote')
		return showMessage('error', 'Invalid game type selected');
	const fileType = document.querySelector('[name="load-type"]:checked')?.value;
	if (!fileType) return showMessage('error', 'File location not specified');
	let data;
	if (fileType === 'local') {
		const file = fileUpload.files[0] || currentFile;
		if (!file) return showMessage('error', 'No file specified');
		else if (file.type !== 'application/json')
			return showMessage('error', 'Invalid file format');
		const reader = new FileReader();
		reader.addEventListener('load', () => {
			data = JSON.parse(reader.result);
			const val = validateGameData(data.rounds);
			if (val.status !== 'OK') return showMessage('error', val.message, 2000);
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

			const val = validateGameData(data);
			if (val.status !== 'OK') return showMessage('error', val.message);
			startGame(gameType, data);
		};
		const url = `/games/${filename}`;
		showMessage('info', 'Starting game...');
		handleRequest(url, 'GET', null, handler);
	} else return showMessage('error', 'Invalid file location specified');
};
const handleJoinGame = () => {
	const st = csh.getState();
	const nameData = st.paths.map((p) => p.getAttribute('d'));
	const name = newPlayerName.value;

	if (!name) return showMessage('error', 'You must enter your name');
	if (!joinCode.value)
		return showMessage('error', 'You must enter a join code');

	socket.emit(
		'join-game',
		{
			name,
			nameData,
			uid,
			joinCode: joinCode.value,
		},
		withTimeout(
			(data) => {
				if (data.status !== 'OK') showMessage('error', data.message);
				else if (data.message) showMessage('info', data.message);
				sh.setState(data.gameState);
				moveBoard();
			},
			() => {
				showMessage('error', 'Joining game timed out.');
			},
		),
	);
};

//handle key press
const handleKeyPress = async (e) => {
	if (!isHost() && !isPlayer()) {
		if (['enter', 'return'].includes(e.key.toLowerCase())) {
			const tp = document.querySelector('.tab-pane.active.show');
			if (!tp) return;
			const tpId = tp.getAttribute('id');
			if (tpId === 'host-tab-pane') return handleCreateGame();
			else if (tpId === 'play-tab-pane') return handleJoinGame();
			else return;
		}
		return;
	}
	const setKey = setKeyButton.getAttribute('data-toggled') === 'true';
	const state = sh.getState();
	if (!state) return;

	//is it a modal key?
	const openModal = document.querySelector('.modal.show');
	if (openModal) {
		const buttons = getElementArray(openModal, 'button');

		buttons.some((btn) => {
			const keys = btn.getAttribute('data-key');
			if (!keys) return false;
			return keys.split(',').some((key) => {
				if (key.toLowerCase() === e.key.toLowerCase()) {
					btn.click();
					return true;
				}
			});
		});
	}

	//open up key window
	if (e.key.toLowerCase() === 'k' && uid === state.host.uid && !isKey)
		return openKey();

	//player input (remote game only)
	if (
		state.isRemote &&
		isPlayer() &&
		['enter', 'return', ' '].includes(e.key.toLowerCase())
	) {
		return socket.emit(
			'buzz',
			withTimeout(
				(data) => {
					if (data.status !== 'OK') showMessage('error', data.message);
				},
				() => {
					showMessage('error', 'Buzz timed out');
				},
			),
		);
	}
	//game is not active, local player setting their buzzer key
	else if (setKey && !state.active) {
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
		}
		//local players cannot have a key reserved for the host
		else if (
			!state.players[playerIndex]?.isRemote &&
			[...state.host.keys, 'c', 'x', 'k'].includes(e.key.toLowerCase())
		) {
			showMessage('warning', `Key is reserved for host - no changes made`);
		}
		//set the key if we passed muster
		//edited to account for remote/local
		else {
			if (playerIndex < state.players.length) {
				if (state.isRemote) {
					state.players[playerIndex].key = e.key;
					buzzerKey.setAttribute('data-key', e.key);
					sh.setState(state);
				} else {
					game.gameState.players[playerIndex].setKey(e.key);
					buzzerKey.setAttribute('data-key', e.key);
					sh.setState(state);
				}
			}
		}
		setKeyButton.setAttribute('data-toggled', 'false');
		setKeyButton.innerHTML = 'Set key';
		return;
	}
	//game is not active, host key pressed to start game
	else if (
		!state?.active &&
		state?.host?.keys?.includes(e.key.toLowerCase()) &&
		state?.buzzedIn === -1
	) {
		if (isHost() && state.players.some((p) => p.name || p.nameData.length > 0))
			startGameModal.show();
		else if (!isHost()) return;
		else
			return showMessage('error', 'You must have at least one active player');
	}
	//host key pressed
	else if ([...state.host.keys, 'c', 'x', 'k'].includes(e.key.toLowerCase())) {
		if (uid !== state.host.uid) return;
		if (state.host.keys.includes(e.key.toLowerCase())) sendGameInput('host');
		else if (e.key.toLowerCase() === 'c') sendGameInput('correct');
		else if (e.key.toLowerCase() === 'x') sendGameInput('incorrect');
	}
	//non-remote player key pressed
	else {
		const ind = state.players.findIndex(
			(p) => e.key === p.key && p.name !== '' && !p.isRemote,
		);
		if (ind < 0) return;
		sendGameInput('player', ind);
	}
};
const sendKey = (e) => {
	//is it a modal key?
	const openModal = document.querySelector('.modal.show');
	if (openModal) {
		const buttons = getElementArray(openModal, 'button');

		buttons.some((btn) => {
			const keys = btn.getAttribute('data-key');
			if (!keys) return false;
			return keys.split(',').some((key) => {
				if (key.toLowerCase() === e.key.toLowerCase()) {
					btn.click();
					return true;
				}
			});
		});
	}

	if (!window.opener) return;
	const evt = new CustomEvent('receive-key', { detail: { key: e.key } });
	window.opener.document.dispatchEvent(evt);
};

let emitEvent;
if (isKey) {
	emitEvent = (data) => {
		const evt = new CustomEvent('emit-event', { detail: data });
		window.opener.document.dispatchEvent(evt);
	};
}

//main game - handle key press on keydown, receive key from control window
if (!isKey) {
	document.addEventListener('keydown', handleKeyPress);
	document.addEventListener('receive-key', (e) => {
		handleKeyPress({ key: e.detail.key });
	});
	//main window - handling input sent from key window
	document.addEventListener('receive-input', (e) => {
		const { args } = e.detail;
		try {
			if (game) game.handleInput(...args);
			else if (socket) socket.emit('game-input', args, socketCB());
		} catch (err) {
			const evt = new CustomEvent('receive-message', {
				detail: { type: 'error', message: err.message },
			});
			if (keyWindow) keyWindow.document.dispatchEvent(evt);
		}
	});
	//main window - handling game input sent from key window
	document.addEventListener('key-input', (e) => {
		const state = sh.getState();
		//special case - pregame host input pops up the "start game" prompt.
		//almost everything else actually sends an input
		if (state.state === 'pregame' && e.detail.input === 'host') {
			return handleKeyPress({ key: 'ArrowDown' });
		}
		sendGameInput(e.detail.input);
	});
	//main window - handling request for socket to send something from key window
	document.addEventListener('emit-event', (e) => {
		const { eventName, data, onSuccess, onTimeout } = e.detail;
		if (isPlayer() || isHost())
			socket.emit(
				eventName,
				data,
				withTimeout(
					onSuccess ? onSuccess : (data) => {},
					onTimeout ? onTimeout : () => {},
				),
			);
	});
}
//control window - on key press, send it to the main window to manage the state
else {
	document.addEventListener('keydown', sendKey);
	document.addEventListener('receive-message', (e) => {
		showMessage(e.detail.type, e.detail.message);
	});
}

const validateGameData = (data) => {
	const fail = (msg) => {
		return { status: 'fail', message: msg };
	};
	if (!data) return fail('No data was found');
	else if (!Array.isArray(data) || data.length !== 3)
		return fail('Data must have a rounds array of 3 rounds');
	else if (!data[2].category || !data[2].text || !data[2].response) {
		return fail(
			'Final Jeopardy round is missing category, text, or response data',
		);
	} else {
		for (var round = 0; round <= 1; round++) {
			const rd = data[round];
			if (rd.length !== 6)
				return fail(`Round ${round + 1} does not contain 6 valid categories`);
			for (var category = 0; category < rd.length; category++) {
				if (!rd[category].category || rd[category].category.trim() === '')
					return fail(
						`Round ${round + 1}, category ${
							category + 1
						} does not have valid category text`,
					);
				const clues = rd[category].clues;
				if (clues.length !== 5)
					return fail(
						`Round ${round + 1}, category ${
							category + 1
						} does not contain 5 valid clues`,
					);

				for (var clue = 0; clue < 5; clue++) {
					const cl = clues[clue];
					if (!cl.text || cl.text.trim() === '')
						return fail(
							`Round ${round + 1}, category ${category + 1}, clue ${
								clue + 1
							} does not contain text`,
						);
					if (!cl.response || cl.response.trim() === '')
						return fail(
							`Round ${round + 1}, category ${category + 1}, clue ${
								clue + 1
							} does not contain a response`,
						);
				}
			}
		}
	}
	return { status: 'OK' };
};

const catLarge = new StateHandler(false);
const moveBoard = () => {
	const elements = getElementArray(
		document,
		// '.game-container > .ratio.ratio-4x3 > div'
		'.game-container > .board-container.ratio.screen-ratio > div',
	);
	const destination = document.querySelector(
		// '.board-display-container > .ratio.ratio-4x3',
		'.board-display-container > .ratio.screen-ratio',
	);
	elements.forEach((el) => destination.appendChild(el));
	const showCategory = (e) => {
		const state = sh.getState();
		if (state.state !== 'select') return;
		const box = e.target.closest('.category-box');
		const inner = box.querySelector('.category-div');

		if (!inner) return;

		const txt = categoryLarge.querySelector('.category-text');
		txt.innerHTML = inner.innerHTML;
		categoryLarge.classList.remove('d-none');
		catLarge.setState(true);
	};

	const hideCategory = () => {
		const st = catLarge.getState();
		if (st) {
			categoryLarge.classList.add('d-none');
			catLarge.setState(false);
		}
	};
	gameHeaders.forEach((gh) => {
		if (!isMobile) {
			gh.addEventListener('mousedown', showCategory);
			document.addEventListener('mouseup', hideCategory);
		} else {
			gh.addEventListener('touchstart', showCategory, { passive: true });
			document.addEventListener('touchend', hideCategory);
		}
	});
};

document.addEventListener('DOMContentLoaded', () => {
	const uidTest = retrieveClientId();
	if (uidTest) uid = uidTest;

	if (isKey && !window.opener) location.href = '/';

	if (!isKey) {
		socket = io();

		socket.on('ack-connection', () => {
			//see if a client id is stored in local storage
			const myId = retrieveClientId();
			//if not, get one and store it
			if (!myId) {
				socket.emit(
					'request-id',
					null,
					withTimeout(
						(data) => {
							if (data.status !== 'OK') showMessage('error', data.message);
							if (data.id) {
								uid = data.id;
								setClientId(uid);
							}
						},
						() => {
							showMessage('error', 'Could not connect to server');
						},
					),
				);
			}
			//if so, send it to get our state back
			else {
				socket.emit(
					'verify-id',
					{ id: myId },
					withTimeout(
						(data) => {
							if (data.status !== 'OK') showMessage('error', data.message);
							if (data.id) {
								uid = data.id;
								setClientId(uid);
							}
							if (data.gameState) sh.setState(data.gameState);
							if (isPlayer()) moveBoard();
						},
						() => {
							showMessage('error', 'Could not connect to server');
						},
					),
				);
			}
		});

		socket.on('update-game-state', (data) => {
			const state = sh.getState();
			if (state.state !== data.state && data.state === 'FJOver') {
				saveFJResponse(true);
			}

			if (data.reset) {
				delete data.reset;
				sh.setState(data);
			} else {
				const state = sh.getState();
				const newState = {
					...state,
					...data,
				};
				if (state.selectedClue.some((rc) => rc !== -1)) {
					newState.board[state.round][state.selectedClue[0]].clues[
						state.selectedClue[1]
					].selected = true;
				}
				sh.setState(newState);
			}
			if (!isKey) sendGameState(data);
		});

		socket.on('game-timeout', (data) => {
			showMessage('error', 'Game timed out', 2000);
			setTimeout(() => location.reload(), 2000);
		});
		window.addEventListener('beforeunload', () => {
			if (keyWindow) keyWindow.close();
		});
		window.addEventListener('key-closed', () => {
			keyWindow = null;
		});
	} else {
		window.addEventListener('beforeunload', () => {
			const evt = new CustomEvent('key-closed', { detail: null });
			window.opener.dispatchEvent(evt);
		});
	}

	const sounds = getElementArray(document, 'audio');

	sounds.forEach((s, i) => {
		s.load();
		s.addEventListener('ended', () => {
			s.pause();
			s.currentTime = 0;
		});
	});

	if (createButton) {
		createButton.addEventListener('click', handleCreateGame);
	}

	const createMetadataTags = (metadata) => {
		const attributes = Object.getOwnPropertyNames(metadata);
		attributes.forEach((attr) => {
			const value = metadata[attr];
			const newLine = createElement('.metadata-attr');
			const title = createElement('.metadata-title');
			const val = createElement('.metadata-data');
			val.innerHTML = value;
			title.innerHTML = `${attr}:`;
			newLine.appendChild(title);
			newLine.appendChild(val);
			gameMetadata.appendChild(newLine);
		});
	};

	const processFileMetadata = (file) => {
		if (gameMetadata) gameMetadata.innerHTML = '';
		else return;

		const reader = new FileReader();
		reader.addEventListener('load', () => {
			const data = JSON.parse(reader.result);
			const metadata = data?.metadata;
			if (!metadata) return;
			createMetadataTags(metadata);
		});
		reader.readAsText(file, 'utf-8');
	};

	if (!isKey) {
		fileUpload.addEventListener('change', (e) => {
			const selectedRadio = document.querySelector(
				'input[type="radio"][name="load-type"][value="local"]:checked',
			);
			if (!selectedRadio) return;
			let file = e.target.files[0];
			if (!file && !currentFile) return;

			if (!file) file = currentFile;
			else currentFile = file;

			if (file.type.toLowerCase() !== 'application/json') {
				e.target.value = '';
				return showMessage('error', 'Only JSON files are accepted', 2000);
			} else if (file.size > 1248576 * 2) {
				e.target.value = '';
				return showMessage('error', 'The maximum file size is 2 MB', 2000);
			}
			const lfn = document.querySelector('.load-file-name');
			if (lfn) lfn.innerHTML = file.name;
			processFileMetadata(file);
		});

		loadType.forEach((lt) => {
			lt.addEventListener('change', (e) => {
				if (!e.target.checked) return;
				if (gameMetadata) gameMetadata.innerHTML = '';

				if (e.target.value === 'local') {
					const file = fileUpload.files[0];
					if (!file) return;
					const reader = new FileReader();
					reader.addEventListener('load', () => {
						const data = JSON.parse(reader.result);
						const metadata = data?.metadata;
						if (!metadata) return;
						createMetadataTags(metadata);
					});
					reader.readAsText(file, 'utf-8');
				}
			});
		});
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
				if (gameMetadata) gameMetadata.innerHTML = '';
				const metadata = JSON.parse(e.target.getAttribute('data-metadata'));
				if (metadata) {
					createMetadataTags(metadata);
				}
			};
			files.forEach((f) => f.addEventListener('click', selectFile));
		}
	}

	sh.addWatcher(initContainer, (e) => {
		if (!e?.detail) return;
		if (e.detail) hidePanel(e.target);
		else showPanel(e.target);
	});

	sh.addWatcher(gameContainer, (e) => {
		const other = document.querySelector('.board-display-container');
		if (!uid) uid = retrieveClientId();
		if (isKey || isSpectator()) showPanel(e.target);
		else if (!e.detail || e.detail.host.uid !== uid) hidePanel(e.target);
		else showPanel(e.target);

		if (!e.detail) {
			e.target.setAttribute('data-round', 0);
			if (other) other.setAttribute('data-round', 0);
		} else if (e.detail.round === e.detail.board.length - 1) {
			e.target.setAttribute('data-round', 'fj');
			if (other) other.setAttribute('data-round', 'fj');
		} else {
			e.target.setAttribute('data-round', Math.max(0, e.detail.round) + 1);
			if (other)
				other.setAttribute('data-round', Math.max(0, e.detail.round) + 1);
		}
	});

	const loadPlayerData = (e) => {
		if (isKey) return;
		const state = sh.getState();
		if (state.state !== 'pregame') return;
		const lec = e.target.closest('.lectern');
		if (!lec) return;
		const playerIndex = Number(lec.getAttribute('data-index'));
		if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 2) return;
		pi.setAttribute('value', lec.getAttribute('data-index'));
		playerName.value = state.players[playerIndex]?.name || '';
		let key = state.players[playerIndex]?.key || '[None]';
		if (key.length === 1 && key.charCodeAt(0) === 32) key = 'Space';
		buzzerKey.setAttribute('data-key', key);
		buzzerKey.innerHTML = key;

		const nameData = state.players[playerIndex]?.nameData;

		namePath.innerHTML = '';
		if (nameData && Array.isArray(nameData)) {
			const paths = [];
			nameData.forEach((p) => {
				const np = document.createElementNS(
					'http://www.w3.org/2000/svg',
					'path',
				);
				np.setAttribute('d', p);
				namePath.appendChild(np);
				paths.push(np);
			});
			csh.setState({
				paths,
				mousedown: false,
			});
		}

		playerSettingsModal.show();
		const svgCont = psm ? psm.querySelector('.svg-container') : null;
		if (svgCont) {
			const tt = new bootstrap.Popover(svgCont);
			tt.show();
			setTimeout(() => {
				tt.dispose();
				svgCont.removeAttribute('data-bs-toggle');
				svgCont.removeAttribute('data-bs-content');
				svgCont.removeAttribute('data-bs-title');
			}, 2000);
		}
	};
	const loadPlayerDataKey = (e) => {
		if (!isKey) return;
		const state = sh.getState();
		const lec = e.target.closest('.lectern');
		if (!lec) return;
		const playerIndex = Number(lec.getAttribute('data-index'));
		if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 2) return;
		pi.setAttribute('value', lec.getAttribute('data-index'));
		const playerData = state.players[playerIndex];

		editPlayerHeader.innerHTML = playerData.name;
		editPlayerName.setAttribute('value', playerData.name);
		editPlayerScore.setAttribute('value', playerData.score);
		editPlayerModal.show();
	};

	editPlayerButtons.forEach((b, i) => {
		b.addEventListener('click', loadPlayerData);
		sh.addWatcher(b, (e) => {
			if (!e.detail) return;
			if (isKey || e.detail.state !== 'pregame' || !isHost())
				e.target.classList.add('d-none');
			else e.target.classList.remove('d-none');

			const ep = e.target.closest('.edit-player');
			const player = e.detail.players[i];
			if (ep && (player?.name || player?.nameData.length > 0))
				ep?.classList.add('d-none');
			else ep?.classList.remove('d-none');
		});
	});
	nameDisplays.forEach((nd, i) => {
		if (!isKey) nd.addEventListener('click', loadPlayerData);
		else nd.addEventListener('click', loadPlayerDataKey);
		sh.addWatcher(nd, (e) => {
			if (!e.detail) return;
			if (
				e.detail.players[i]?.name &&
				(!e.detail.players[i]?.nameData ||
					e.detail.players[i].nameData.length === 0)
			) {
				e.target.classList.remove('d-none');
				e.target.innerHTML = e.detail.players[i].name;
			} else e.target.classList.add('d-none');
		});
	});

	svgDisplays.forEach((s, i) => {
		if (!isKey) s.addEventListener('click', loadPlayerData);
		else s.addEventListener('click', loadPlayerDataKey);

		sh.addWatcher(s, (e) => {
			const path = e.target.querySelector('.player-name-path');
			path.innerHTML = '';
			const player = e.detail.players[i];
			if (!player) return;
			const nameData = player.nameData;
			if (!nameData || nameData.length === 0) {
				e.target.classList.add('d-none');
				return;
			}
			nameData.forEach((nd) => {
				const np = document.createElementNS(
					'http://www.w3.org/2000/svg',
					'path',
				);
				np.setAttribute('d', nd);
				path.appendChild(np);
			});
			e.target.classList.remove('d-none');
		});
	});

	if (setKeyButton)
		setKeyButton.addEventListener('click', (e) => {
			const curr = e.target.getAttribute('data-toggled');
			e.target.setAttribute(
				'data-toggled',
				curr === 'false' ? 'true' : 'false',
			);
			e.target.innerHTML = curr === 'false' ? '[Press a key]' : 'Set key';
		});

	if (confirmEditPlayer) {
		if (!isKey)
			confirmEditPlayer.addEventListener('click', () => {
				const index = getPlayerIndex();
				const state = sh.getState();
				const nameData = csh.getState();
				if (isNaN(index) || index < 0 || index >= state.players.length)
					return pi.removeAttribute('value');

				const lec = document.querySelector(`.lectern[data-index="${index}"]`);
				if (!lec) return pi.removeAttribute('value');
				const key = buzzerKey.getAttribute('data-key');
				const name = playerName.value;
				if (!name) return showMessage('error', 'You must enter a player name.');
				if (!state.isRemote) {
					if (
						index < game.gameState.players.length &&
						game.gameState.players[index]
					) {
						if (!playerName.value)
							return showMessage('error', 'You must specify a name');
						game.gameState.players[index].setName(playerName.value);
						game.gameState.players[index].setKey(key);
						if (Array.isArray(nameData.paths)) {
							game.gameState.players[index].setNameData(
								nameData.paths.map((p) => p.getAttribute('d')),
							);
						}
					}

					csh.setState({
						paths: [],
						mouseDown: false,
					});
					namePath.innerHTML = '';
					game.updateGameState();
					pi.removeAttribute('value');
					playerSettingsModal.hide();
				} else {
					const data = {
						player: index,
						gameId: state.id,
						uid,
						name: playerName.value,
						key,
						nameData: Array.isArray(nameData.paths)
							? nameData.paths.map((p) => p.getAttribute('d'))
							: [],
					};
					socket.emit(
						'edit-player',
						data,
						socketCB(() => playerSettingsModal.hide()),
					);
				}
			});
		else {
			confirmEditPlayer.addEventListener('click', () => {
				const index = getPlayerIndex();
				const data = {
					name: editPlayerName.value,
					score: isNaN(Number(editPlayerScore.value))
						? null
						: Number(editPlayerScore.value),
				};
				sendGameInput('editPlayer', index, data);
				editPlayerModal.hide();
			});
			assignControl.addEventListener('click', () => {
				const index = getPlayerIndex();
				const evt = new CustomEvent('assign-control', { detail: index });
				if (!window.opener) return;
				return window.opener.document.dispatchEvent(evt);
			});
		}
	}

	if (cancelEditPlayer)
		cancelEditPlayer.addEventListener('click', () => {
			pi.removeAttribute('value');
			playerName.value = '';
			if (buzzerKey) buzzerKey.innerHTML = '[None]';
		});

	if (removePlayer)
		removePlayer.addEventListener('click', () => {
			const index = getPlayerIndex();
			const state = sh.getState();
			if (!state || state.state !== 'pregame') return;
			game.resetPlayer(index);
			playerSettingsModal.hide();
		});

	if (!isKey) {
		confirmStartGame.addEventListener('click', () => {
			sendGameInput('start');
			startGameModal.hide();
		});
		sh.addWatcher(buzzerKey, (e) => {
			const ind = getPlayerIndex();
			if (isNaN(ind) && !e.detail) return;

			if (!e.detail) {
				const defaultKeys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
				e.target.innerHTML = defaultKeys[ind];
				return;
			}

			if (ind >= e.detail.players.length) return;
			let key = e.detail.players[ind].key;

			if (key.charCodeAt(0) === 32) key = 'Space';
			e.target.innerHTML = key;
		});
	}

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

	const showView = (div) => {
		views.forEach((v) => {
			if (v === div) v.classList.remove('d-none');
			else v.classList.add('d-none');
		});
	};

	//main screen display as function of state
	sh.addWatcher(null, (state) => {
		if (!state) return;
		const maxCategoryLength = 25;

		if (state.state === 'waitingDD') {
			//waiting for a DD wager
			showView(gameBoard);
			//play the sound
			if (!isKey && ddSound && state.playSound) {
				ddSound.play();
			} else if (isKey) {
				//set up and show the dd wager modal
				const round = state.round;
				const minMaxWager = (round + 1) * 1000;
				const player = state.players[state.control];
				if (!player) return;
				maxWager.innerHTML = Math.max(minMaxWager, player.score);

				ddPlayerName.innerHTML = player.name;

				if (state.playSound && ddWagerModal) {
					setTimeout(() => {
						ddWager.value = '';
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
					).toFixed(3)}%`,
				);
				setTimeout(() => {
					ddDiv.classList.add('animation');
				}, 1);
			}
		} else if (state.selectedClue[0] !== -1 && state.selectedClue[1] !== -1) {
			const [cat, row] = state.selectedClue;
			if (cat === -1 || row === -1) return;
			//show the live clue view
			showView(liveClue);
			const liveCategory = getCategory(cat);
			liveClueData = liveCategory.clues[row];

			//if the DD wager is set, show it (otherwise, the value of the clue)
			if (
				state.state === 'showDD' ||
				state.state === 'DDLive' ||
				state.state === 'DDTimedOut'
			) {
				liveValue.classList.add('dd');
				liveValue.innerHTML = state.wager;
			} else {
				liveValue.classList.remove('dd');
				liveValue.innerHTML = liveClueData.value;
			}

			//display the category
			if (liveCategory.category.trim().length >= maxCategoryLength)
				liveClueCategory.classList.add('long-cat');
			else liveClueCategory.classList.remove('long-cat');

			liveClueCategory.innerHTML = liveCategory.category;
			if (liveCategory.caps === false)
				liveClueCategory.classList.remove('caps');
			else liveClueCategory.classList.add('caps');

			//display the response if we're in the key
			if (isKey && liveResponse) {
				if (liveClueData.caps === false) liveResponse.classList.remove('caps');
				else liveResponse.classList.add('caps');
				liveResponse.innerHTML = liveClueData.response;
			}

			//if we're in the first 500 ms, flash the clue value and we're done
			if (state.state === 'showClueValue') {
				liveClueText.classList.add('d-none');
				liveClueImage.classList.add('d-none');
				liveClueValue.innerHTML = liveClueData.value;
				liveClueValue.classList.remove('d-none');
				return;
			}
			//otherwise, disappear the large live clue value
			liveClueValue.classList.add('d-none');

			//if there's an image and it's not the key, show the image
			if (liveClueData.image && !isKey) {
				liveClueText.classList.add('d-none');
				liveClueImage.classList.remove('d-none');
				liveClueImage.setAttribute(
					'style',
					`background-image:url("${liveClueData.image}")`,
				);
			}
			//show the clue text in the key, or if there's no image
			else {
				liveClueText.classList.remove('d-none');
				//if the clue is specifically marked as not caps, remove the all caps class
				if (liveClueData.caps === false) liveClueText.classList.remove('caps');
				//otherwise add it
				else liveClueText.classList.add('caps');

				liveClueImage.classList.add('d-none');
				liveClueText.innerHTML = liveClueData.text;
			}

			//in the key, display the correct response
			if (isKey) ddWagerModal.hide();
		} else if (state.state === 'boardIntro' && state.categoryShown >= -1) {
			showView(categoryScroll);
			if (startGameModal) startGameModal.hide();
			categoryDisplays.forEach((cb, i) => {
				const ind = Number(cb.getAttribute('data-col'));
				if (ind > state.categoryShown) cb.classList.add(`category-hidden`);
				else if (ind === state.categoryShown) {
					setTimeout(() => cb.classList.remove('category-hidden'), 500);
					const cd = cb.querySelector('.category-div');
					const cc = cb.querySelector('.comment-div');
					const txt = getCategory(i)?.category;
					if (txt.trim().length >= maxCategoryLength)
						cd.classList.add('long-cat');
					else cd.classList.remove('long-cat');
					cd.innerHTML = getCategory(i)?.category || '';
					if (isKey && cc) cc.innerHTML = getCategory(i)?.comments || '';
					else if (!isKey && cc) cc.innerHTML = '';
				}
			});
			categoryScrollInner.style.left = `${-100 * state.categoryShown}%`;
		} else if (state.state === 'select') {
			showView(gameBoard);
			gameHeaders.forEach((g, i) => {
				const cd = g.querySelector('.category-div');
				const cat = getCategory(i);
				if (!cat || cat.clues.every((c) => c.selected)) {
					cd.innerHTML = '';
				} else {
					if (cat.category.trim().length >= 30) cd.classList.add('long-cat');
					else cd.classList.remove('long-cat');
					cd.innerHTML = cat.category.trim();
				}
				g.classList.remove('category-hidden');
			});
		} else if (state.state === 'betweenRounds') {
			showView(gameBoard);
			gameHeaders.forEach((g, i) => {
				g.classList.add('category-hidden');
			});
		} else if (state.state === 'FJIntro') {
			showView(fjCategory);
			const catInner = fjCategory.querySelector('.category-box');
			catInner.classList.add('category-hidden');
		} else if (state.state === 'FJCategory') {
			showView(fjCategory);
			const catInner = fjCategory.querySelector('.category-box');
			if (catInner) catInner.classList.remove('category-hidden');
			else return;
			const catText = catInner.querySelector('.category-div');
			if (catText) {
				const cat = state.board.slice(-1).pop().category.trim();
				if (cat.length >= maxCategoryLength) catInner.classList.add('long-cat');
				else catInner.classList.remove('long-cat');
				catText.innerHTML = cat.toUpperCase();
			}
			if (state.playSound && fjSound) fjSound.play();
			if (isKey) {
				const populateLabels = (lbl) => {
					const ind = Number(lbl.getAttribute('data-index'));
					if (isNaN(ind) || !state.players[ind].name) {
						lbl.classList.add('d-none');
					} else lbl.innerHTML = state.players[ind].name;
				};
				fjWagerLabels.forEach(populateLabels);
				fjWagerRadios.forEach((inp, i) => {
					inp.addEventListener('change', (e) => {
						if (e.target.checked) {
							if (state.players[i].isRemote) {
								fjWagerMax.disabled = true;
								fjWagerZero.disabled = true;
							} else {
								fjWagerMax.disabled = false;
								fjWagerZero.disabled = false;
							}
						}
					});
				});
				fjResponseLabels.forEach(populateLabels);
				fjMaxWagers.forEach((mw) => {
					const ind = Number(mw.getAttribute('data-index'));
					if (
						isNaN(ind) ||
						!state.players[ind].name ||
						state.players[ind].score <= 0
					)
						return;
					const maxWager = state.players[ind].score;
					mw.innerHTML = maxWager;
					const inp = mw
						.closest('.fj-wager-container')
						.querySelector('input.fj-wager');
					inp.setAttribute('max', maxWager);
					if (state.players[ind].isRemote) inp.disabled = true;
					else inp.disabled = false;
				});

				const fjWagers = getElementArray(document, '.fj-wager');
				fjWagers.forEach((fjw) => {
					const ind = Number(fjw.getAttribute('data-index'));
					if (!state.players[ind]) fjw.value = '';
					else if (state.players[ind].finalWager < 0) fjw.value = '';
					else fjw.value = Number(state.players[ind].finalWager);
				});

				fjWagerModal.show();
			} else if (isPlayer()) {
				if (fjpwm) {
					const player = state.players.find((p) => p.uid === uid);
					if (player) {
						const currentWager = player.finalWager;
						const category =
							state.board[state.board.length - 1].category.toUpperCase();
						const catContainers = getElementArray(
							document,
							'.fj-category-container',
						);
						catContainers.forEach((c) => (c.innerHTML = category));
						if (currentWager === -1 && player.score > 0) {
							const maxWager = player.score;
							const mw = fjpwm.querySelector('.fj-player-max-wager');
							if (mw) mw.innerHTML = maxWager;
							const inp = fjpwm.querySelector('.fj-player-wager');
							inp.setAttribute('max', maxWager);
							fjPlayerWagerModal.show();
						}
					}
				}
			}
		} else if (state.state === 'showFJ') {
			if (fjWagerModal) fjWagerModal.hide();
			if (fjPlayerWagerModal) fjPlayerWagerModal.hide();
			showView(liveClue);
			const fj = state.board.slice(-1).pop();
			liveClueText.classList.remove('d-none');
			liveClueImage.classList.add('d-none');
			liveClueText.innerHTML = fj.text;
			liveValue.innerHTML = ``;

			if (fj.category.trim().length >= maxCategoryLength)
				liveClueCategory.classList.add('long-cat');
			else liveClueCategory.classList.remove('long-cat');
			liveClueCategory.classList.add('caps');

			liveClueCategory.innerHTML = fj.category;
			if (isKey && liveResponse) {
				liveResponse.innerHTML = fj.response;
				if (fj.caps === false) liveResponse.classList.remove('caps');
				else liveResponse.classList.add('caps');
			}
		} else if (state.state === 'FJLive') {
			showView(liveClue);
			if (state.playSound && thinkMusic && (isHost() || isPlayer()))
				thinkMusic.play();
			if (isKey && fjResponseModal) fjResponseModal.show();
			if (isPlayer()) {
				const clueContainer = document.querySelector('#fj-clue-container-resp');
				if (clueContainer) {
					const fj = state.board.slice(-1).pop();
					clueContainer.innerHTML = fj.text.toUpperCase();
				}
				fjPlayerResponseModal.show();
			}
		} else if (state.state === 'FJOver') {
			if (thinkMusic) thinkMusic.pause();
			// if (fjResponseModal) fjResponseModal.hide();
			if (fjPlayerResponseModal) fjPlayerResponseModal.hide();
			showView(fjResponseDiv);
		} else if (state.state === 'endGame') {
			showView(gameBoard);
			if (egm) {
				endGameMessage.innerHTML = state.status;
				ackEndGame.addEventListener('click', () => {
					endGameModal.hide();
					setTimeout(() => location.reload(), 1000);
				});
				document.addEventListener('data-ready', () => endGameModal.show());
				const evt = new CustomEvent('process-data', {
					detail: {
						players: state.players,
						gameData: state.gameData || null,
					},
				});
				document.dispatchEvent(evt);
			}
		} else {
			showView(gameBoard);
		}
	});

	sh.addWatcher(null, (state) => {
		if (state.state !== 'pregame') {
			if (isKey && state.isRemote)
				document.title = `Control Panel - Game ${state.joinCode.toUpperCase()}`;
		}
	});

	sh.addWatcher(fjResponseDisplay, (e) => {
		const state = e.detail;
		if (state.state !== 'FJOver' || state.fjStep === -1) return;
		if (state.fjStep % 4 === 0) {
			e.target.classList.remove('animate');
			e.target.classList.remove('revealed');
			e.target.innerHTML = '';
		} else {
			const p = Math.floor(state.fjStep / 4);
			const ind = state.fjOrder[p];
			const player = state.players[ind];
			e.target.innerHTML = `${state.fjPrefix ? state.fjPrefix + ' ' : ''}${
				player.finalResponse
			}?`;
			e.target.classList.add('animate');
			setTimeout(() => {
				e.target.classList.add('revealed');
				if (isKey) e.target.classList.add('revealed-sm');
			}, 1);
		}
	});

	sh.addWatcher(fjWagerDisplay, (e) => {
		const state = e.detail;
		if (state.state !== 'FJOver' || state.fjStep === -1) return;

		if (state.fjStep % 4 <= 1) {
			e.target.classList.remove('animate');
			e.target.classList.remove('revealed');
			e.target.innerHTML = '';
		} else {
			const p = Math.floor(state.fjStep / 4);
			const ind = state.fjOrder[p];
			const player = state.players[ind];

			e.target.innerHTML = `${player.finalWager}`;
			e.target.classList.add('animate');
			setTimeout(() => {
				e.target.classList.add('revealed');
				if (isKey) e.target.classList.add('revealed-sm');
			}, 1);
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
			const clue = getClue(cat, row);
			if (
				!clue ||
				state.round >= state.board.length - 1 ||
				state.round < 0 ||
				clue.selected
			) {
				e.target.innerHTML = '';
				return;
			} else e.target.innerHTML = clue.value;
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
			if (
				e.detail.buzzedIn === ind &&
				(e.detail.state === 'buzz' || e.detail.state === 'pregame')
			) {
				e.target.classList.add('lit');
				if (e.detail.state === 'buzz')
					startTimerLights(l, e.detail.currentTime - e.detail.buzzTime);
			} else if (
				e.detail.state === 'FJOver' &&
				e.detail.fjOrder[Math.floor(e.detail.fjStep / 4)] === ind
			) {
				e.target.classList.add('lit');
			} else e.target.classList.remove('lit');
		}),
	);

	const selectClue = (e) => {
		if (!isHost()) return;
		const [cat, row] = getCatRow(e.target);
		const state = sh.getState();
		if (state?.state !== 'select') return;
		sendGameInput('clue', cat, row);
	};
	clueBoxes.forEach((cb) => cb.addEventListener('click', selectClue));

	sh.addWatcher(liveClue, (e) => {
		const tl =
			e.detail.state === 'clueLive'
				? e.detail.clueTime
				: e.detail.state === 'DDLive'
					? e.detail.ddTime
					: e.detail.state === 'FJLive'
						? e.detail.FJTime
						: null;

		if (tl === null) return e.target.classList.remove('live');
		console.log(tl);
		const timeLimit = tl / 1000;

		const style = `animation-duration:${timeLimit}s`;
		console.log(sideLights);
		sideLights.forEach((s) => {
			const inner = s.querySelector('.side-light-inner');
			inner.setAttribute('style', style);
		});

		setTimeout(() => {
			liveClue.classList.add('live');
		}, 1);
	});

	scoreDisplays.forEach((sd, i) => {
		sh.addWatcher(sd, (e) => {
			if (!e.detail) return;
			if (isKey && e.detail.state === 'buzz') {
				const bz = e.detail.currentBuzz;
				if (
					bz?.data &&
					bz.data.length >= i + 1 &&
					bz.data[i].buzz &&
					bz.data[i].time !== null &&
					!isNaN(bz.data[i].time)
				) {
					e.target.classList.add('rt');
					e.target.innerHTML = `${bz.data[i].time}`;
					return;
				}
			}
			e.target.classList.remove('rt');
			const player = e.detail.players[i];
			if (!player || !player.name) {
				e.target.innerHTML = '';
				return;
			}

			const score = e.detail.players[i]?.score || 0;

			if (score >= 0) e.target.classList.remove('neg');
			else e.target.classList.add('neg');

			const str = Math.abs(score).toLocaleString('en');
			e.target.innerHTML = str;
		});
	});

	if (ddDiv)
		sh.addWatcher(ddDiv, (e) => {
			if (e.detail.state !== 'waitingDD')
				e.target.classList.remove('animation');
		});

	sh.addWatcher(null, (state) => {
		if (state?.message?.trim()) {
			showMessage('info', state.message);
		}
		if (state?.isRemote && socket)
			socket.emit('update-game-state', state, 1500);
		if (state) {
			if (isPlayer() || isKey) document.body.classList.add('dark');
			else if (isHost() || isSpectator()) document.body.classList.add('bg-jep');
		} else {
			document.body.classList.remove('dark');
			document.body.classList.remove('bg-jep');
		}
	});

	sh.addWatcher(timeoutSound, (e) => {
		if (!e.detail) return;
		else if (!isKey && e.detail.timeout && e.detail.playSound) {
			timeoutSound.play();
		}
	});

	//open the key automatically when a game is started
	if (!isKey)
		sh.addWatcher(
			null,
			(state) => {
				if (state && isHost() && !keyWindow) openKey();
			},
			{ once: true },
		);

	//send game state to key window on state update
	if (!isKey)
		sh.addWatcher(null, (state) => {
			if (state.isRemote) return;
			sendGameState(state);
		});
	if (isKey)
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
			const maxWager = Math.max(player.score, (state.round + 1) * 1000);
			if (wager > maxWager)
				return showMessage(
					'error',
					`Invalid wager - maximum wager is $${maxWager}`,
				);
			sendGameInput('setWager', wager);
		});

	if (confirmFJWagers)
		confirmFJWagers.addEventListener('click', () => {
			const wagers = getElementArray(fjw, '.fj-wager').map((inp, i) => {
				const index = Number(inp.getAttribute('data-index'));
				const player = index >= 0 ? index : null;
				const wager = Number(inp.value) || 0;
				if (isNaN(index)) return null;
				return {
					player,
					wager,
				};
			});
			sendGameInput('setWager', wagers);
		});

	const wagerSetter = (isMax) => {
		return () => {
			const checked = fjw.querySelector(
				'input[type="radio"][name="fj-wager-radio"]:checked',
			);
			if (!checked) return;
			const ind = checked.getAttribute('data-index');
			const inp = fjw.querySelector(`input.fj-wager[data-index="${ind}"]`);
			if (!inp) return;
			inp.value = isMax ? Number(inp.getAttribute('max')) : 0;
		};
	};
	if (wagerZero) wagerZero.addEventListener('click', wagerSetter(false));
	if (wagerMax) wagerMax.addEventListener('click', wagerSetter(true));

	//change default prefix for final jeopardy answers
	//edited to handle both socket and local
	const handlePrefixChange = (e) => {
		if (!e.target.checked) return;
		let val = e.target.value;
		if (val === '[None]') val = '';
		const state = sh.getState();

		if (state.isRemote) {
			emitEvent({
				eventName: 'edit-game-data',
				data: {
					gameData: { fjPrefix: val },
				},
				onSuccess: (data) => {
					sh.setState(data.gameState);
				},
				onTimeout: () => {
					showMessage('error', 'Request timed out');
				},
			});
		} else
			sh.setState((prev) => {
				return {
					...prev,
					fjPrefix: val,
				};
			});
	};
	if (fjPrefixDiv && fjPrefixDiv.length > 0) {
		fjPrefixDiv.forEach((fjp) => {
			sh.addWatcher(fjp, (e) => {
				e.target.innerHTML = e.detail.fjPrefix;
			});
		});
		let pf = fjr?.querySelector(
			'.fj-prefix-container input[type="radio"]:checked',
		);
		if (pf) {
			const val = pf.value;
			fjPrefixDiv.forEach((fjp) => {
				fjp.innerHTML = val === '[None]' ? '' : val;
			});
		}
	}
	if (fjPrefixes) {
		fjPrefixes.forEach((p) => {
			p.addEventListener('change', handlePrefixChange);
		});
		const ps1 = getElementArray(fjw, 'input[name="fj-wager-radio"]');
		const ps2 = getElementArray(fjr, 'input[name="fj-response-radio"]');

		sh.addWatcher(null, (state) => {
			const handleDisableRadios = (el) => {
				const ind = Number(el.value);
				const score = state.players[ind]?.score;
				if (!score || score <= 0) {
					el.disabled = true;
					el.checked = false;
				} else {
					el.disabled = false;
					if (!el.parentElement.querySelector('input[type="radio"]:checked'))
						el.checked = true;
				}
			};
			ps1.forEach(handleDisableRadios);
			ps2.forEach(handleDisableRadios);
		});
	}

	if (confirmFJResponses) {
		if (fjResponses)
			fjResponses.forEach((fjr, i) => {
				sh.addWatcher(fjr, (e) => {
					if (e.detail.players[i].isRemote) {
						e.target.disabled = true;
						e.target.value = e.detail.players[i].finalResponse;
					} else e.target.disabled = false;
				});
			});
		confirmFJResponses.addEventListener('click', () => {
			const state = sh.getState();
			if (!state.isRemote) {
				fjResponses.forEach((res) => {
					const ind = Number(res.getAttribute('data-index'));
					state.players[ind].finalResponse = res.value;
				});
				sh.setState(state);
				fjResponseModal.hide();
			} else {
				const toSend = fjResponses
					.map((fjr, i) => {
						return {
							player: i,
							response: fjr.value,
						};
					})
					.filter((fjr, i) => {
						return !state.players[i].isRemote;
					});
				sendGameInput('setFJResponses', toSend);
			}
		});
	}

	if (nameCanvas) {
		const [vbw, vbh] = [400, 300];
		const getCanvasDimensions = (canvas) => {
			let rect = canvas.getBoundingClientRect();
			return [rect.width, rect.height];
		};
		const scaleCanvasDimensions = (canvas, x, y) => {
			const [w, h] = getCanvasDimensions(canvas);
			x = Math.min(Math.max(0, x), w);
			y = Math.min(Math.max(0, y), h);
			return [(x * vbw) / w, (y * vbh) / h];
		};

		let moveCount = 0;
		const startPath = (e) => {
			if (isMobile && e.type !== 'touchstart') return;
			else if (!isMobile && e.type !== 'mousedown') return;
			const canvas = e.target.closest('svg');

			moveCount = 0;
			csh.setState((prev) => {
				const rect = canvas.getBoundingClientRect();
				const { pageX, pageY } =
					e.type === 'touchstart' ? e.targetTouches[0] : e;
				const [offsetX, offsetY] = [pageX - rect.left, pageY - rect.top];
				const [x, y] = scaleCanvasDimensions(canvas, offsetX, offsetY);

				const newPath = document.createElementNS(
					'http://www.w3.org/2000/svg',
					'path',
				);
				newPath.setAttribute('d', `M ${x} ${y} l 0 0 `);
				const path = canvas.querySelector('.name-path');
				path.appendChild(newPath);
				return {
					canvas,
					paths: [...prev.paths, newPath],
					mouseDown: true,
				};
			});
		};

		getElementArray(document, '.name-canvas').forEach((nc) => {
			nc.addEventListener('mousedown', startPath);
			nc.addEventListener('touchstart', startPath, { passive: true });
		});

		const drawPath = (e) => {
			if (isMobile && e.type !== 'touchmove') return;
			else if (!isMobile && e.type !== 'mousemove') return;

			const state = csh.getState();
			if (!state.mouseDown) return;
			moveCount++;
			if (granularity === 1 || moveCount % granularity === 1) {
				const rect = state.canvas.getBoundingClientRect();
				const { pageX, pageY } =
					e.type === 'touchmove' ? e.targetTouches[0] : e;
				const [offsetX, offsetY] = [pageX - rect.left, pageY - rect.top];
				const [x, y] = scaleCanvasDimensions(state.canvas, offsetX, offsetY);

				const currentPath = state.paths[state.paths.length - 1];
				if (!currentPath) return;
				currentPath.setAttribute(
					'd',
					`${currentPath.getAttribute('d')} L ${x} ${y}`,
				);
			}
		};

		document.addEventListener('mousemove', drawPath);
		document.addEventListener('touchmove', drawPath, { passive: true });

		const endPath = (e) => {
			if (isMobile && e.type !== 'touchend') return;
			else if (!isMobile && e.type !== 'mouseup') return;
			csh.setState((prev) => {
				return {
					...prev,
					canvas: null,
					mouseDown: false,
				};
			});
		};

		document.addEventListener('mouseup', endPath);
		document.addEventListener('touchend', endPath);

		const undoStroke = (e) => {
			const path = e.target
				.closest('.draw-player-name')
				?.querySelector('.name-path');
			if (!path) return;
			const state = csh.getState();
			if (!state) return;

			const paths = getElementArray(path, 'path');
			if (paths.length > 0) paths[paths.length - 1].remove();
			state.paths.pop();
			csh.setState(state);
		};
		const clearStroke = (e) => {
			const state = csh.getState();
			if (!state) return;
			const path = e.target
				.closest('.draw-player-name')
				?.querySelector('.name-path');
			if (!path) return;
			const paths = getElementArray(path, 'path');
			paths.forEach((p) => p.remove());
			state.paths = [];
			csh.setState(state);
		};

		getElementArray(document, 'button.undo-stroke').forEach((b) =>
			b.addEventListener('click', undoStroke),
		);
		getElementArray(document, 'button.clear-stroke').forEach((b) =>
			b.addEventListener('click', clearStroke),
		);
	}

	if (isKey) {
		//add player list to this area during pregame, so that we can shuffle players
		const statusPanel = document.querySelector('.status-panel');
		sh.addWatcher(statusPanel, (e) => {
			e.target.innerHTML = e.detail.status;
		});
		sh.addWatcher(openModalPanel, (e) => {
			if (e.detail.modal) {
				e.target.classList.remove('d-none');
				openModal.innerHTML = e.detail.modalDescription;
				openModal.setAttribute('data-bs-target', `#${e.detail.modal}`);
			} else {
				e.target.classList.add('d-none');
			}
		});
		const sendInputFromKey = (e) => {
			const inp = e.target.getAttribute('data-input');
			window.opener.document.dispatchEvent(
				new CustomEvent('key-input', { detail: { input: inp } }),
			);
		};
		[advanceButton, correctButton, incorrectButton].forEach((b) =>
			b.addEventListener('click', sendInputFromKey),
		);

		randomizeButton.addEventListener('click', () => {
			const state = sh.getState();
			if (!state) return;

			if (!state.isRemote) sendGameInput('shuffle');
			else {
				emitEvent({
					eventName: 'shuffle-players',
				});
			}
		});

		const handleMovePlayer = (e) => {
			const playerItem = e.target.closest('.player-order-item');
			if (!playerItem) return;
			const player = Number(playerItem.getAttribute('data-player'));
			if (isNaN(player)) return;
			const direction = e.target.getAttribute('data-direction');
			if (!direction) return;
			const state = sh.getState();
			if (!state) return;
			if (!state.isRemote) {
				sendGameInput('movePlayer', player, direction);
			} else {
				emitEvent({
					eventName: 'move-player',
					data: {
						player,
						direction,
					},
				});
			}
		};
		movePlayerButtons.forEach((b) => {
			b.addEventListener('click', handleMovePlayer);
		});
		sh.addWatcher(movePlayerPanel, (e) => {
			if (e.detail.state !== 'pregame') e.target.classList.add('d-none');
			else e.target.classList.remove('d-none');
		});
		sh.addWatcher(randomizeButton, (e) => {
			e.target.disabled =
				e.detail.state !== 'pregame' ||
				e.detail.players.every((p) => p.name === '');
		});
		sh.addWatcher(null, (state) => {
			movePlayerButtons.forEach((b) => {
				const player = Number(
					b.closest('.player-order-item')?.getAttribute('data-player'),
				);
				if (isNaN(player)) {
					b.disabled = true;
					return;
				}
				const direction = b.getAttribute('data-direction');
				if (direction === 'up')
					b.disabled =
						player === 0 ||
						state.players[player].name === '' ||
						state.players[player - 1].name === '';
				else if (direction === 'down')
					b.disabled =
						player === state.players.length - 1 ||
						state.players[player].name === '' ||
						state.players[player + 1].name === '';
				else b.disabled = true;
			});
		});
		sh.addWatcher(null, (state) => {
			movePlayerLabels.forEach((l) => {
				const player = Number(
					l.closest('.player-order-item')?.getAttribute('data-player'),
				);
				if (isNaN(player)) {
					l.innerHTML = '(Empty)';
					return;
				} else {
					const name = state.players[player].name;
					l.innerHTML = `${name.trim() !== '' ? name.trim() : '(Empty)'}`;
				}
			});
		});

		const handleGameCancel = () => {
			const evt = new CustomEvent('cancel-game', { detail: null });
			if (window.opener) window.opener.document.dispatchEvent(evt);
		};
		cancelGame.addEventListener('click', () => {
			const state = sh.getState();
			if (!state) return;

			if (!state.isRemote) handleGameCancel();
			else if (isHost) {
				emitEvent({
					eventName: 'cancel-game',
					onSuccess: (data) => {
						if (data.status === 'OK') {
							showMessage('info', 'Game cancelled');
							setTimeout(handleGameCancel, 1000);
						}
					},
					onTimeout: () => {
						showMessage('error', 'Something went wrong');
					},
				});
			}
		});
	} else {
		document.addEventListener('cancel-game', () => {
			location.reload();
		});
		socket.on('game-cancelled', () => {
			if (isPlayer()) {
				showMessage('info', 'Game has been cancelled by host');
				setTimeout(() => {
					location.reload();
				}, 1000);
			}
		});
	}

	let buzzerButton, playerScore;
	if (playerContainer) {
		buzzerButton = playerContainer.querySelector('#buzzer');
		playerScore = playerContainer.querySelector('.score');
	}

	if (joinGameButton) joinGameButton.addEventListener('click', handleJoinGame);

	if (spectateGame)
		spectateGame.addEventListener('click', () => {
			if (!joinCode.value)
				return showMessage('error', 'You must enter a join code');

			socket.emit(
				'spectate-game',
				{
					uid,
					joinCode: joinCode.value,
				},
				withTimeout(
					(data) => {
						if (data.status !== 'OK') showMessage('error', data.message);
						else if (data.message) showMessage('info', data.message);
						sh.setState(data.gameState);
					},
					() => {
						showMessage('error', 'Joining game timed out.');
					},
				),
			);
		});
	if (buzzerButton)
		buzzerButton.addEventListener('click', (e) => {
			const state = sh.getState();
			const ind = state.players.findIndex(
				(p) => uid === p.uid && p.name !== '',
			);
			if (ind < 0) return;
			sendGameInput('player', ind);
		});

	if (playerContainer)
		sh.addWatcher(playerContainer, (e) => {
			const state = e.detail;
			const player = state?.players?.find((p) => p.uid === uid);

			if (player) {
				showPanel(e.target);
				const editPlayer = e.target.querySelector('.edit-player');
				hidePanel(editPlayer);

				//should the buzzer be armed?
				const buzzer = document.querySelector('#buzzer');
				if (buzzer.getAttribute('data-bs-toggle') === 'popover') {
					const tt = new bootstrap.Popover(buzzer);
					tt.show();
					setTimeout(() => {
						tt.dispose();
						buzzer.removeAttribute('data-bs-title');
						buzzer.removeAttribute('data-bs-toggle');
						buzzer.removeAttribute('data-bs-content');
					}, 1500);
				}
				if (
					state.state === 'clueLive' ||
					(state.state === 'pregame' && state.buzzedIn === -1)
				) {
					buzzer.classList.add('armed');
				} else buzzer.classList.remove('armed');

				//buzzer displays name on buzz-in, otherwise "buzz"
				if (state.buzzedIn === -1 || !state.players[state.buzzedIn]?.name)
					buzzer.innerHTML = 'Buzz';
				else buzzer.innerHTML = state.players[state.buzzedIn].name;

				const lecterns = getElementArray(
					playerContainer,
					'.player-lectern-mini',
				);
				lecterns.forEach((l, i) => {
					const ind = Number(l.getAttribute('data-index'));
					const nameDisp = l.querySelector('.name-display .display-inner');
					const scoreDisp = l.querySelector('.score-display .display-inner');
					if (
						isNaN(ind) ||
						ind < 0 ||
						ind >= state.players.length ||
						!nameDisp ||
						!scoreDisp
					)
						return;
					const p = state.players[ind];
					const name = state.players[ind].name.trim();
					nameDisp.innerHTML = name;
					const score = p.score;
					if (score < 0) scoreDisp.classList.add('neg');
					else scoreDisp.classList.remove('neg');

					scoreDisp.innerHTML =
						name === '' ? '' : Math.abs(score).toLocaleString('en');

					if (state.control === ind) l.classList.add('control');
					else l.classList.remove('control');

					if (state.buzzedIn === ind) l.classList.add('lit');
					else l.classList.remove('lit');
				});
			} else return hidePanel(e.target);
		});

	let to, tt;
	const handlePopover = (e) => {
		const svgCont = document.querySelector(
			'#play-tab-pane .svg-container[data-bs-toggle="popover"]',
		);
		const disposeTT = () => {
			try {
				if (tt) tt.dispose();
				svgCont.removeAttribute('data-bs-toggle');
				svgCont.removeAttribute('data-bs-content');
			} catch (err) {}
		};
		if (e.target.getAttribute('id') === 'play-tab') {
			if (svgCont) {
				tt = new bootstrap.Popover(svgCont);
				if (tt) {
					tt.show();
					to = setTimeout(disposeTT, 2000);
				}
			}
		} else if (tt && to) {
			clearTimeout(to);
			disposeTT();
			tt = null;
			to = null;
		}
	};
	document.addEventListener('shown.bs.tab', handlePopover);
	const pt = document.querySelector('#play-tab.active');
	if (pt) handlePopover({ target: pt });
});
