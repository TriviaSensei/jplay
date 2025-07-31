const ddDistribution = [
	[5, 756, 2491, 3636, 3112],
	[2, 99, 286, 382, 231],
];

const generateRandom = (dist) => {
	const s = dist.reduce((p, c) => p + c);
	let sum = 0;
	const x = Math.floor(Math.random() * s);
	return dist.findIndex((el) => {
		sum = sum + el;
		return sum >= x;
	});
};

const chars = 'abcdefghijklmnopqrstuvwxyz01234567890';
const letters = 'abcdefghijklmnopqrstuvwxyz';
const randomString = (len, str) => {
	let toReturn = '';
	for (var i = 0; i < len; i++) {
		toReturn = `${toReturn}${str.charAt(
			Math.floor(Math.random() * str.length)
		)}`;
	}
	return toReturn;
};

const lockTimeout = 250;
const clueTimeout = 3500;
const ddTimeout = 7000;
const FJTime = 30000;
const cluesPerRound = 5;

class Player {
	constructor(name, uid, socketId, key, isRemote) {
		this.name = name;
		this.socketId = socketId;
		this.uid = uid || uuidV4();
		this.score = 0;
		this.locked = false;
		this.lockTimeout = null;
		this.key = key;
		this.isRemote = isRemote;
		this.finalWager = -1;
		this.finalResponse = '';
	}

	lock(autoUnlock) {
		console.log(`Locking ${this.name}`);
		this.locked = true;
		if (this.lockTimeout) clearTimeout(this.lockTimeout);
		if (autoUnlock) this.lockTimeout = setTimeout(this.unlock, lockTimeout);
	}

	unlock() {
		console.log(`Unocking ${this.name}`);
		console.trace();
		if (this.lockTimeout) {
			clearTimeout(this.lockTimeout);
			this.lockTimeout = null;
		}
		this.locked = false;
	}

	isLocked() {
		return this.locked;
	}

	isRemote() {
		return this.isRemote;
	}

	setRemote(isRemote) {
		this.isRemote = isRemote;
	}

	setSocketId(id) {
		this.socketId = id;
	}

	getUID() {
		return this.uid;
	}

	getName() {
		return this.name;
	}

	getSocketId() {
		return this.socketId;
	}

	getScore() {
		return this.score;
	}

	getKey() {
		return this.key;
	}

	setKey(key) {
		this.key = key;
	}

	setName(name) {
		this.name = name;
	}

	setScore(score) {
		this.score = score;
	}

	modifyScore(diff) {
		this.score = this.score + diff;
	}

	setFinalWager(wager) {
		if (wager >= 0) this.finalWager = wager;
		else throw new Error('Your final wager must be at least 0');
	}

	setFinalResponse(response) {
		if (!this.finalResponse) this.finalResponse = response;
		else throw new Error('You have already submitted a response');
	}

	getFinalWager() {
		return this.finalWager;
	}

	getFinalResponse() {
		return this.finalResponse;
	}

	getData() {
		const { name, socketId, uid, score, finalWager, finalResponse, key } = this;
		return {
			name,
			socketId,
			uid,
			score,
			finalWager,
			finalResponse,
			key,
		};
	}
}
/**
 * Input list:
 * - Start (start button)
 * - Player (any player buzzer)
 * - Host (the host button)
 * - Clue (a clue being selected)
 * - Correct/Incorrect (host indicating a correct/incorrect response)
 */

class Game {
	handleResponse = (correct) => {
		return () => {
			try {
				//someone has to be buzzed in, and there must be a selected clue
				if (this.gameState.buzzedIn < 0) return;
				const sc = this.gameState.selectedClue;
				if (sc.some((el) => el < 0)) return;
				const clue =
					this.gameState.board[this.gameState.round][sc[0]].clues[sc[1]];
				//adjust the score
				this.gameState.players[this.gameState.buzzedIn].modifyScore(
					correct ? clue.value : -clue.value
				);

				//a correct answer was given
				if (correct) {
					//unlock all buzzers
					this.unlockAll();
					//are there clues left?
					if (
						this.gameState.board[this.gameState.round].some((cat) => {
							return cat.clues.some((cl) => !cl.selected);
						}) &&
						this.gameState.board[this.gameState.round].reduce((p, c) => {
							return p + c.clues.reduce((cl) => (cl.selected ? 1 : 0));
						}, 0) < cluesPerRound
					) {
						//give control to the player that buzzed in and gave the correct response
						this.setGameState({
							state: 'select',
							control: this.gameState.buzzedIn,
						});
					}
					//round is over
					else {
						this.setGameState({
							state: 'betweenRounds',
							round: this.gameState.round + 1,
						});
					}
				}
				//an incorrect answer was given
				else {
					//lock this player out for the question
					this.gameState.players[this.gameState.buzzedIn].lock(false);
					//if any one is elibible, go back to clueLive
					if (this.gameState.players.some((p) => !p.isLocked()))
						this.setGameState({
							state: 'clueLive',
						});
					//everyone is locked out - are there clues left?
					else if (
						this.gameState.board[this.gameState.round].some((cat) => {
							return cat.clues.some((cl) => !cl.selected);
						}) &&
						this.gameState.board[this.gameState.round].reduce((p, c) => {
							return p + c.clues.reduce((cl) => (cl.selected ? 1 : 0));
						}, 0) < cluesPerRound
					) {
						//unlock all buzzers
						this.unlockAll();
						//go back to select without changing control of board
						this.setGameState({
							state: 'select',
						});
					} //round is over
					else {
						this.setGameState({
							state: 'betweenRounds',
							round: this.gameState.round + 1,
						});
					}
				}
				console.log(this.gameState);
			} catch (err) {
				return console.log(err);
			}
		};
	};

	handleDDResponse = (correct) => {
		this.stopClueTimer();
		const p = this.gameState.control;
		if (p < 0)
			throw new Error('Invalid game state - no player in control for DD');
		this.gameState.players[p].modifyScore(
			correct ? this.gameState.wager : -this.gameState.wager
		);
		//are there clues left?
		if (
			this.gameState.board[this.gameState.round].some((cat) => {
				return cat.clues.some((cl) => !cl.selected);
			}) &&
			this.gameState.board[this.gameState.round].reduce((p, c) => {
				return p + c.clues.reduce((cl) => (cl.selected ? 1 : 0));
			}, 0) < cluesPerRound
		) {
			//clear the wager
			this.setGameState({
				state: 'select',
				wager: -1,
			});
		}
		//round is over
		else {
			this.setGameState({
				state: 'betweenRounds',
				round: this.gameState.round + 1,
				wager: -1,
			});
		}
	};

	handleFJResponse = (correct) => {
		if (this.gameState.fjStep % 2 !== 1) return;
		//player whose response we are judging
		const p = this.gameState.fjOrder[(this.gameState.fjStep - 1) / 2];
		const player = this.gameState.players[p];
		const wager = player.getFinalWager();
		this.gameState.fjStep++;
		this.modifyPlayerScore(p, correct ? wager : -wager);
	};

	handleBuzz = (p) => {
		try {
			console.log(p);
			//if the player is locked, don't do anything
			if (this.gameState.players[p].isLocked()) return;
			//stop the clue timeout, set the game state
			this.stopClueTimer();
			const now = Date.now();
			this.setGameState({
				state: 'buzz',
				buzzedIn: p,
				buzzTime: now,
				currentTime: now,
			});
		} catch (err) {
			return console.log(err);
		}
	};
	/**
	 * General Game States:
	 * - pregame: game has not started
	 * - boardIntro: fill board, show categories
	 * - select: waiting for active player to select a clue
	 * - showClue: clue is showing, but buzzer is not active
	 * - waitingDD: showing DD screen, waiting for a DD wager
	 * - DDLive: DD is live, buzzers not active
	 * - clueLive: clue is active, players may buzz in
	 * - buzz: a player is buzzed in
	 * - betweenRounds: a round has finished, waiting on host to start next round.
	 * - FJCategory: showing FJ category, waiting for wagers
	 * - showfJ: showing FJ clue, timer not live
	 * - FJLive: showing FJ clue, timer live
	 * - FJResults: progressing through FJ responses, wagers, and final scores
	 * - endGame: end of game
	 */
	stateMap = {
		//each state has a data attribute of game state attributes that are always true during that game state, but may change
		//from the immediately previous state
		//pregame: game has not started
		pregame: {
			data: {
				active: false,
				buzzerArmed: false,
				buzzedIn: -1,
				buzzTime: null,
				timeout: false,
				control: -1,
				wager: -1,
				selectedClue: [-1, -1],
				currentTime: null,
			},
			//representing an input when the game is in that state.
			//if the input is not valid from that state, then there is no function
			//for it. If it is a valid input, then the function will run and set the new game state.
			start: () => {
				if (
					this.gameState.players.length > 0 &&
					this.gameState.players.some((p) => p.getName() !== '')
				) {
					this.setGameState({
						state: 'boardIntro',
						round: 0,
						categoryShown: -2,
					});
				} else throw new Error('You must have at least one player.');
			},
			player: (p) => {
				this.handleBuzz(p);
			},
			host: () => {
				this.setGameState({
					buzzedIn: -1,
				});
			},
		},
		//boardIntro: fill board, show categories
		boardIntro: {
			data: {
				active: true,
			},
			host: () => {
				if (
					this.gameState.categoryShown <
					this.gameState.board[this.gameState.round].length - 1
				) {
					this.setGameState({
						categoryShown: this.gameState.categoryShown + 1,
					});
				} else if (
					this.gameState.categoryShown ===
					this.gameState.board[this.gameState.round].length - 1
				) {
					const control = this.gameState.players.reduce((p, c, i) => {
						if (c.getScore() < this.gameState.players[p].getScore()) return i;
						return p;
					}, 0);
					const roundNames = ['', 'Double ', 'Triple '];
					this.setGameState({
						control,
						state: 'select',
						message: `${this.gameState.players[control].getName()} starts the ${
							roundNames[this.gameState.round]
						}Jeopardy round.`,
					});
				}
			},
		},
		//select: waiting for active player to select a clue
		select: {
			data: {
				buzzerArmed: false,
				buzzedIn: -1,
				buzzTime: null,
				wager: -1,
				selectedClue: [-1, -1],
				currentTime: null,
			},
			clue: (cat, row) => {
				const rd = this.gameState.round;
				const clue = this.gameState.board[rd][cat].clues[row];
				if (clue.selected) return;
				clue.selected = true;
				if (clue.dailyDouble)
					this.setGameState({ state: 'waitingDD', playSound: true });
				else
					this.setGameState({
						state: 'showClue',
						selectedClue: [cat, row],
					});
			},
		},
		//showClue: clue is showing, but buzzer is not active
		showClue: {
			//this only comes from the select state, and nothing changes between those states except for selected clue, which
			//is variable
			data: {},
			//the host activates the buzzers
			host: () => {
				//if the clue hasn't timed out, set it live on host input
				if (!this.gameState.timeout) {
					this.setGameState({
						state: 'clueLive',
					});
					this.startClueTimer(clueTimeout, {
						buzzerArmed: false,
						buzzedIn: -1,
						state: 'showClue',
					});
				}
				//go back to select screen if the clue is timed out
				else {
					this.setGameState({
						state: 'select',
						timeout: false,
					});
				}
			},
			//a player tries to buzz but it's too early
			player: (p) => {
				try {
					this.gameState.players[p].lock(false);
					this.updateGameState(p);
				} catch (err) {
					return console.log(err);
				}
			},
		},
		//clueLive: clue is active, players may buzz in
		clueLive: {
			//can only come from showClue or buzz
			data: {
				buzzerArmed: true,
				buzzedIn: -1,
				buzzTime: null,
				currentTime: null,
			},
			player: (p) => {
				this.handleBuzz(p);
			},
		},
		//buzz: a player is buzzed in
		buzz: {
			//can only come from clueLive - buzzer is disarmed
			data: {
				buzzerArmed: false,
			},
			correct: this.handleResponse(true),
			incorrect: this.handleResponse(false),
		},
		//waitingDD: showing DD screen, waiting for a DD wager
		waitingDD: {
			host: () => {
				if (this.gameState.control === -1)
					throw new Error('Invalid game state');
				//make sure a valid wager has been submitted,
				const minWager = 5;
				const minMaxWager = (this.gameState.round + 1) * 1000;
				const p = this.gameState.players[this.gameState.control];
				const maxWager = Math.max(minMaxWager, p.getScore());
				if (this.gameState.wager < minWager && this.gameState.wager > maxWager)
					throw new Error(
						`Please submit a valid wager from $${minWager} to $${maxWager}`
					);
				//valid wager has been submitted - show the clue
				this.setGameState({
					state: 'DDLive',
				});
				this.startClueTimer(ddTimeout, null);
			},
		},
		//DDLive: DD is live, buzzers not active
		DDLive: {
			data: {},
			correct: () => {
				this.handleDDResponse(true);
			},
			incorrect: () => {
				this.handleDDResponse(false);
			},
		},
		// betweenRounds: a round has finished, waiting on host to start next round.
		betweenRounds: {
			data: {
				control: -1,
				message: null,
				wager: -1,
				buzzerArmed: false,
				buzzedIn: -1,
			},
			host: () => {
				//entering final jeopardy
				if (this.gameState.round === this.gameState.board.length - 1) {
					//make sure at least one player is eligible for FJ
					if (this.gameState.players.some((p) => p.getScore > 0)) {
						this.setGameState({
							state: 'FJCategory',
						});
					} else {
						this.setGameState({
							state: 'endGame',
							message: 'Game over - no player was eligible for Final Jeopardy.',
						});
					}
				}
				//entering next round
				else
					this.setGameState({
						state: 'boardIntro',
						categoryShown: -2,
					});
			},
		},
		//FJCategory: showing FJ category, waiting for wagers
		FJCategory: {
			data: {},
			host: () => {
				//make sure valid wagers have been submitted for anyone still in the game
				const inv = this.gameState.players.find(
					(p) =>
						p.getScore() > 0 &&
						(p.getFinalWager() < 0 || p.getFinalWager() > p.getScore())
				);
				if (inv)
					throw new Error(`Invalid or missing wager from ${inv.getName()}`);

				//valid wager has been submitted - show the clue
				this.setGameState({
					state: 'showFJ',
				});
			},
		},
		//showfJ: showing FJ clue, timer not live
		showFJ: {
			data: {},
			host: () => {
				this.setGameState({
					state: 'FJLive',
					playSound: true,
				});
				const fjOrder = this.gameState.players
					.map((p, i) => {
						return {
							score: p.getScore(),
							index: i,
						};
					})
					.sort((a, b) => a.score - b.score)
					.map((el) => el.index);
				this.startClueTimer(FJTime, { fjOrder, fjStep: 0, fjLock: true });
			},
		},
		//FJLive: showing FJ clue, timer live
		FJLive: {
			data: {},
			host: () => {
				this.setGameState({ state: 'FJResults' });
			},
		},
		FJResults: {
			data: {},
			host: () => {
				//we've revealed everything. Acknowledge the winners and end the game
				if (this.gameState.fjStep === this.gameState.players.length * 2 - 1) {
					const hs = this.gameState.players.reduce((p, c) => {
						return Math.max(c.getScore(), p);
					}, 0);
					const winners = this.gameState.players
						.filter((p) => p.getScore() === hs)
						.map((p) => p.getName());
					let message;
					if (winners.length === 1) {
						message = `${winners[0]} wins with $${hs.toLocaleString('en-US')}!`;
					} else if (winners.length === 2) {
						message = `${winners[0]} and ${
							winners[1]
						} tie with $${hs.toLocaleString('en-US')}!`;
					} else {
						winners[winners.length - 1] = `and ${winners[length - 1]}`;
						message = `${winners.join(', ')} tie with $${hs.toLocaleString(
							'en-US'
						)}!}`;
					}
					this.setGameState({ state: 'endGame', message });
				}
				if (this.gameState.fjStep % 2 === 0)
					this.setGameState({ fjStep: this.gameState.fjStep + 1 });
			},
			correct: () => {
				this.handleFJResponse(true);
			},
			incorrect: () => {
				this.handleFJResponse(false);
			},
		},
		endGame: {
			host: () => {
				this.setGameState(null);
			},
		},
	};

	constructor(board, host, socket, stateHandler) {
		this.id = randomString(20, chars);
		this.joinCode = randomString(4, letters);
		this.socket = socket;
		this.stateHandler = stateHandler;
		this.isRemote = socket ? true : false;
		this.clueTimeout = null;
		//randomly place the DDs by distribution
		const dd1c = Math.floor(Math.random() * board[0].length);
		const dd1r = generateRandom(ddDistribution[0]);

		const dd2c = [];
		for (var i = 0; i < board[1].length; i++) {
			if (Math.random() <= (2 - dd2c.length) / (board[1].length - i)) {
				dd2c.push(i);
			}
			if (dd2c.length === 2) break;
		}

		const dd2r = dd2c.map((el) => generateRandom(ddDistribution[1]));

		this.gameState = {
			active: false, //whether the game is active
			state: 'pregame',
			joinCode: this.joinCode,
			isRemote: this.isRemote,
			buzzerArmed: false, //whether a buzz will be accepted
			buzzedIn: -1, //which player (0,1,2) is buzzed in, -1 if no one
			buzzTime: null,
			timeout: false,
			categoryShown: -2,
			control: -1, //which player has control of the board, -1 if no one
			wager: -1, //the DD wager for the active clue, -1 if N/A
			host, //host info (socket ID, UID)
			players: [], //player info (name, socketID, UID, key, score)
			board: board.map((r, i) => {
				if (i === 2) return r;
				else if (i === 0)
					return r.map((cat, j) => {
						return {
							...cat,
							clues: cat.clues.map((clue, k) => {
								return {
									...clue,
									value: (k + 1) * 200,
									selected: false,
									dailyDouble: k === dd1r && j === dd1c,
								};
							}),
						};
					});
				else if (i === 1)
					return r.map((cat, j) => {
						return {
							...cat,
							clues: cat.clues.map((clue, k) => {
								return {
									...clue,
									value: (k + 1) * 400,
									selected: false,
									dailyDouble:
										(k === dd2r[0] && j === dd2c[0]) ||
										(k === dd2r[1] && j === dd2c[1]),
								};
							}),
						};
					});
			}), //array of rounds. 0 and 1 are arrays of categories, each with an array of clues. 2 is FJ
			selectedClue: [-1, -1], //selected clue (category, row)
			currentTime: null,
			playSound: false,
			message: null,
			fjOrder: null,
			fjStep: -1,
			fjLock: false,
			round: -1,
		};

		for (var i = 0; i < 3; i++) {
			this.addPlayer(`player${i + 1}`, null, null);
		}

		this.updateGameState();
	}

	getId() {
		return this.id;
	}

	sanitizeGameState() {
		return {
			...this.gameState,
			currentTime: Date.now(),
			board: this.gameState.board.map((r, i) => {
				if (i === 2) return r;
				else if (Array.isArray(r)) {
					return r.map((cat, j) => {
						return {
							...cat,
							clues: cat.clues.map((clue) => {
								const temp = {
									...clue,
								};
								delete temp.dailyDouble;
								return temp;
							}),
						};
					});
				}
			}),
		};
	}

	getGameState(sanitize) {
		if (sanitize) return this.sanitizeGameState();
		return {
			...this.gameState,
			currentTime: Date.now(),
		};
	}

	updateGameState(player) {
		if (this.stateHandler) this.stateHandler.setState(this.gameState);
		if (this.socket) {
			if (
				(typeof player).toLowerCase() === 'number' &&
				player >= 0 &&
				player < this.gameState.players.length
			) {
				const p = this.gameState.players[player];
				this.socket.to(p.socketId).emit('update-game-state', this.gameState);
			} else
				this.socket.to(this.getId()).emit('update-game-state', this.gameState);
		}
		this.gameState.playSound = false;
	}

	isRemote() {
		return this.isRemote;
	}

	addPlayer(name, id, socketId) {
		if (this.gameState.players.length >= 3) return;
		const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
		const toAdd = new Player(
			name,
			id || randomString(20, chars),
			this.isRemote ? socketId : null,
			keys[this.gameState.players.length],
			this.isRemote
		);
		this.gameState.players.push(toAdd);
		this.updateGameState();
	}

	resetPlayer(index) {
		if (this.gameState.players.length > index && index >= 0) {
			const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
			this.gameState.players[index].setName('');
			this.gameState.players[index].uid = randomString(20, chars);
			this.gameState.players[index].setKey(keys[index]);
			this.gameState.players[index].setRemote(this.isRemote);
			this.gameState.players[index].setSocketId(null);
			this.updateGameState();
		}
	}

	shufflePlayers() {
		if (this.gameState.active) return;
		const temp = this.gameState.players.map((p) => {
			return {
				player: p,
				order: Math.random(),
			};
		});
		temp.sort((a, b) => a.order - b.order);
		this.gameState.players = temp.map((p) => {
			return p.player;
		});
		this.updateGameState();
	}

	swapPlayers(a, b) {
		if (
			a >= this.gameState.players.length ||
			b >= this.gameState.players.length ||
			this.gameState.active
		)
			return;
		[this.gameState.players[a], this.gameState.players[b]] = [
			this.gameState.players[b],
			this.gameState.players[a],
		];
		this.updateGameState();
	}

	handleInput(...args) {
		if (args.length === 0) return;
		//the input
		const fn = args.shift();
		//the current game state
		const gs = this.gameState.state;
		//the function to run as a result
		const st = this.stateMap[gs];
		if (!st) throw new Error(`Invalid game state (${gs})`);
		const f = st[fn];
		//invalid input for this state - don't do anything
		if (!f) return console.log('invalid input');
		f(...args);
	}

	setGameState(state) {
		console.log(state);
		let newData = {};
		if (state.state && state.gameState !== this.gameState.state) {
			const newState = state.state;
			if (this.stateMap[newState]?.data) newData = this.stateMap[newState].data;
		}
		this.gameState = {
			...this.gameState,
			...state,
			...newData,
		};
		this.updateGameState();
		if (this.gameState.message) this.gameState.message = '';
		if (this.gameState.playSound) this.gameState.playSound = false;
	}

	setPlayerScore(player, score) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].setScore(score);
		this.updateGameState();
	}

	modifyPlayerScore(player, diff) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].modifyScore(diff);
		this.updateGameState();
	}

	lockPlayer(player, autoUnlock) {
		if (player >= 0 && player < this.gameState.players.length) {
			this.gameState.players[player].lock(autoUnlock);
			this.updateGameState(player);
		}
	}

	unlockPlayer(player) {
		if (player >= 0 && player < this.gameState.players.length) {
			this.gameState.players[player].unlock();
			this.updateGameState(player);
		}
	}

	unlockAll() {
		this.gameState.players.forEach((p) => p.unlock());
		this.updateGameState();
	}

	handleClueTimeout(nextState) {
		if (this.clueTimeout) clearTimeout(this.clueTimeout);
		this.clueTimeout = null;
		this.setGameState({
			...nextState,
			timeout: true,
			playSound: true,
		});
		this.gameState.playSound = false;
	}

	startClueTimer(limit, nextState) {
		this.clueTimeout = setTimeout(() => {
			this.handleClueTimeout(nextState || null);
		}, limit);
	}

	stopClueTimer() {
		if (this.clueTimeout) clearTimeout(this.clueTimeout);
		this.clueTimeout = null;
	}
}

try {
	module.exports = Game;
} catch (err) {}
