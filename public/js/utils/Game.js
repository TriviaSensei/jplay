const testClues = 2;
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

const chars = 'abcdefghijklmnopqrstuvwxyz01234567809';
const letters = 'abcdefghijklmnopqrstuvwxyz';
const randomString = (len, str) => {
	let toReturn = '';
	for (var i = 0; i < len; i++) {
		toReturn = `${toReturn}${str.charAt(
			Math.floor(Math.random() * str.length),
		)}`;
	}
	return toReturn;
};

const lockTimeout = 250;
const clueTime = 3500;
const ddTime = 10000;
const FJTime = 31000;
const showClueDelay = 500;

let cluesPerRound;

class Player {
	constructor(name, nameData, uid, socketId, key, isRemote) {
		this.name = name;
		this.nameData = Array.isArray(nameData) ? nameData : [];
		this.socketId = socketId;
		this.uid = uid || randomString(20, chars);
		this.score = 0;
		this.scoreHistory = [];
		this.locked = false;
		this.lockTimeout = null;
		this.key = key;
		this.isRemote = isRemote;
		this.finalWager = -1;
		this.finalResponse = '';
		this.finalCorrect = null;
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

	getNameData() {
		return this.nameData;
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

	setNameData(data) {
		this.nameData = Array.isArray(data) ? data : [];
	}

	setScore(score) {
		this.score = score;
	}

	setUID(uid) {
		this.uid = uid;
	}

	modifyScore(diff) {
		this.score = this.score + diff;
	}

	setFinalWager(wager) {
		if (wager < 0) throw new Error('Your final wager must be at least 0');
		else if (wager > this.getScore())
			throw new Error('Your final wager cannot exceed your score');
		this.finalWager = wager;
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
	checkRoundOver() {
		const cluesUsed = this.gameState.board[this.gameState.round].reduce(
			(p, c) => {
				return p + c.clues.reduce((p2, c2) => p2 + (c2.selected ? 1 : 0), 0);
			},
			0,
		);

		if (
			cluesUsed ===
				Math.floor(cluesPerRound / 2 && this.gameState.round === 0) ||
			cluesUsed === cluesPerRound
		)
			this.gameState.players.forEach((p) =>
				p.scoreHistory.unshift(p.getScore()),
			);

		return !(
			this.gameState.board[this.gameState.round].some((cat) => {
				return cat.clues.some((cl) => !cl.selected);
			}) && cluesUsed < cluesPerRound
		);
	}

	getCluesLeft() {
		const round = this.gameState.round;
		if (round < 0 || round >= this.gameState.board.length - 1) return 0;

		const cluesSelected = this.gameState.board[round].reduce((p, c) => {
			return (
				p +
				c.clues.reduce((p2, c2) => {
					if (c2.selected) return p2 + 1;
					return p2;
				}, 0)
			);
		}, 0);

		return cluesPerRound - cluesSelected;
	}

	handleResponse(correct) {
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
					correct ? clue.value : -clue.value,
				);

				this.updateGameStats(this.gameState.buzzedIn, {
					result: correct ? clue.value : -clue.value,
				});

				//a correct answer was given
				if (correct) {
					//unlock all buzzers
					this.unlockAll();
					//are there clues left?
					if (!this.checkRoundOver()) {
						//give control to the player that buzzed in and gave the correct response
						this.setGameState({
							state: 'select',
							control: this.gameState.buzzedIn,
							status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
								this.gameState.buzzedIn
							].getName()} to select a clue`,
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
					this.gameState.players[this.gameState.buzzedIn].locked = true;
					//if any one is eligible, go back to clueLive
					if (this.gameState.players.some((p) => p.name && !p.isLocked())) {
						this.setGameState({
							state: 'clueLive',
							status: `Waiting for buzz`,
							buzzerTime: Date.now(),
						});
						this.startClueTimer(clueTime, {
							buzzerArmed: false,
							buzzedIn: -1,
							state: 'clueTimedOut',
						});
					}
					//everyone is locked out - are there clues left?
					else if (!this.checkRoundOver()) {
						//unlock all buzzers
						this.unlockAll();
						//go back to select without changing control of board
						this.setGameState({
							state: 'select',
							status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
								this.gameState.control
							].getName()} to select a clue`,
						});
					} //round is over
					else {
						this.setGameState({
							state: 'betweenRounds',
							round: this.gameState.round + 1,
						});
					}
				}
			} catch (err) {
				return console.log(err);
			}
		};
	}

	handleDDResponse(correct) {
		this.stopClueTimer();
		const p = this.gameState.control;
		if (p < 0)
			throw new Error('Invalid game state - no player in control for DD');

		const ds = correct ? this.gameState.wager : -this.gameState.wager;
		this.gameState.players[p].modifyScore(ds);
		this.updateGameStats(this.gameState.control, {
			result: ds,
		});
		//are there clues left?
		if (!this.checkRoundOver()) {
			//clear the wager
			this.setGameState({
				state: 'select',
				status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
					this.gameState.control
				].getName()} to select a clue`,
				wager: -1,
				playSound: false,
				modal: '',
				modalDescription: '',
			});
		}
		//round is over
		else {
			this.setGameState({
				state: 'betweenRounds',
				round: this.gameState.round + 1,
				wager: -1,
				playSound: false,
				modal: '',
				modalDescription: '',
			});
		}
	}

	handleFJResponse(correct) {
		if (this.gameState.fjStep % 4 !== 1) return;
		const { category, text, response } = this.gameState.board[2];
		const fjData = `${category.toUpperCase()}<br>${text}<br>${response}`;
		//player whose response we are judging
		const p = this.gameState.fjOrder[(this.gameState.fjStep - 1) / 4];
		const player = this.gameState.players[p];
		player.finalCorrect = correct;
		this.setGameState({
			fjStep: this.gameState.fjStep + 1,
			status: `${fjData}<br><br>${player.name}'s Final Jeopardy wager revealed. Press advance to continue.`,
		});
		this.updateGameStats(p, { correct });
	}

	//this only runs on a valid buzz (pregame test or while a clue is live)
	//not just any press of the buzzer
	handleBuzz(p) {
		try {
			//if the player is locked, don't do anything
			if (this.gameState.players[p].isLocked()) return;

			//stop the clue timeout, set the game state
			this.stopClueTimer();
			const now = Date.now();
			this.setGameState({
				state: this.gameState.active ? 'buzz' : 'pregame',
				buzzedIn: p,
				buzzTime: now,
				currentTime: now,
				status: `${this.gameState.players[p].name} buzzed in`,
			});
			const curr = this.getCurrentClueStats();
			if (!curr) return;
			const alreadyBuzzed = curr.data[p].buzz && curr.data[p].time !== null;
			if (alreadyBuzzed) return;

			this.updateGameStats(p, {
				buzz: true,
				first: curr.data.every((d) => !d.first),
				time: Date.now() - this.gameState.buzzerTime,
			});
		} catch (err) {
			return console.log(err);
		}
	}

	updateGameStats(p, data) {
		if (this.gameData.length === 0) return;
		if (this.gameData[this.gameData.length - 1].data.length <= p) return;

		this.gameData[this.gameData.length - 1].data[p] = {
			...this.gameData[this.gameData.length - 1].data[p],
			...data,
		};

		this.updateGameState(-1, { currentBuzz: this.getCurrentClueStats() });
	}

	getCurrentClueStats() {
		if (this.gameData.length === 0) return null;
		return this.gameData[this.gameData.length - 1];
	}

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
	 * - FJOver: progressing through FJ responses, wagers, and final scores
	 * - endGame: end of game
	 */

	stateMap = {
		all: {
			editPlayer: (ind, data) => {
				this.gameState.players[ind].setName(data.name);
				this.gameState.players[ind].setScore(data.score);
				this.updateGameState(null, { players: this.gameState.players });
			},
		},
		//each state has a data attribute of game state attributes that are always true during that game state, but may change
		//from the immediately previous state
		//pregame: game has not started
		pregame: {
			data: {
				active: false,
				buzzerArmed: true,
				buzzTime: null,
				timeout: false,
				control: -1,
				wager: -1,
				selectedClue: [-1, -1],
				currentTime: null,
				// modal: 'cancel-game-modal',
				// modalDescription: 'Cancel game',
			},

			//representing an input when the game is in that state.
			//if the input is not valid from that state, then there is no function
			//for it. If it is a valid input, then the function will run and set the new game state.
			start: () => {
				if (
					this.gameState.players.length > 0 &&
					this.gameState.players.some((p) => p.getName() !== '')
				) {
					const data = {
						state: 'boardIntro',
						round: 0,
						categoryShown: -2,
						status: 'Board intro - press advance to display next category',
					};
					this.setGameState(data);
					// this.gameState.active = true;
					// this.gameState.state = 'betweenRounds';
					// this.gameState.round = 2;
					// this.gameState.players.forEach((p, i) => {
					// 	if (p.name) p.score = (i + 1) * 200;
					// });
					this.updateGameState(null, data);
				} else throw new Error('You must have at least one player.');
			},
			player: (p) => {
				if (this.gameState.buzzedIn === -1) this.handleBuzz(p);
				// this.setGameState({
				// 	buzzedIn: p,
				// });
			},
			host: () => {
				this.setGameState({
					buzzedIn: -1,
					status: this.pregameStatus,
				});
			},
			shuffle: () => {
				this.shufflePlayers();
			},
			movePlayer: (player, direction) => {
				this.movePlayer(player, direction);
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
						status: `Press advance for next category`,
					});
				} else if (
					this.gameState.categoryShown ===
					this.gameState.board[this.gameState.round].length - 1
				) {
					const control = this.gameState.players.reduce((p, c, i) => {
						if (
							c.getName() !== '' &&
							c.getScore() < this.gameState.players[p].getScore()
						)
							return i;
						return p;
					}, 0);
					const roundNames = ['', 'Double ', 'Triple '];
					this.setGameState({
						control,
						state: 'select',
						message: `${this.gameState.players[control].getName()} starts the ${
							roundNames[this.gameState.round]
						}Jeopardy round.`,
						status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
							control
						].getName()} to select a clue`,
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
				timeout: false,
			},
			action: () => {
				this.gameState.players.forEach((p) => {
					p.locked = false;
				});
			},
			clue: (cat, row) => {
				const rd = this.gameState.round;
				const clue = this.gameState.board[rd][cat].clues[row];
				if (clue.selected) return;
				clue.selected = true;
				const newData = {
					round: this.gameState.round,
					category: cat,
					clue: row,
					data: new Array(3).fill(0).map(() => {
						return {
							buzz: false,
							early: false,
							first: false,
							result: 0,
							time: null,
						};
					}),
				};

				if (clue.dailyDouble) {
					this.setGameState({
						state: 'waitingDD',
						playSound: true,
						selectedClue: [cat, row],
						status: `Waiting for Daily Double wager from ${this.gameState.players[
							this.gameState.control
						].getName()}`,
					});
					this.gameData.push({
						...newData,
						isDD: true,
					});
				} else {
					this.setGameState({
						state: 'showClueValue',
						status: '',
						selectedClue: [cat, row],
					});
					setTimeout(() => {
						this.setGameState({
							state: 'showClue',
							status: `Reading clue. Press advance to arm buzzers`,
							selectedClue: [cat, row],
						});
						this.gameData.push({
							...newData,
							isDD: false,
						});
					}, showClueDelay);
				}
			},
		},
		//showClueValue: temporary state after selecting a clue where the clue value is flashed on the screen
		//no input accepted, will automatically advance after a predetermined period
		showClueValue: {
			data: {},
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
						buzzerTime: Date.now(),
					});
					this.startClueTimer(clueTime, {
						buzzerArmed: false,
						buzzedIn: -1,
						state: 'clueTimedOut',
						status: 'Clue timed out. Press advance to continue.',
					});
				}
				//go back to select screen or between rounds if the clue is timed out
				else {
					//are there clues left?
					if (!this.checkRoundOver()) {
						//back to the select screen
						this.setGameState({
							state: 'select',
							timeout: false,
							status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
								this.gameState.control
							].getName()} to select a clue`,
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
			},
			//a player tries to buzz but the clue isn't live
			player: (p) => {
				try {
					//if the clue is already timed out, do nothing
					if (this.gameState.timeout) return;
					//if the clue is not yet started, lock them out for a period
					this.lockPlayer(p, true);
					this.updateGameState(p, { players: this.gameState.players });
					this.updateGameStats(p, { buzz: true, early: true });
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
				status: 'Waiting for buzz',
			},
			player: (p) => {
				this.handleBuzz(p);
			},
		},
		//clue timed out
		clueTimedOut: {
			data: {
				status: 'Clue timed out. Press "advance" to continue.',
			},
			host: () => {
				const state = this.gameState;
				if (this.checkRoundOver())
					this.setGameState({
						state: 'betweenRounds',
						round: state.round + 1,
						timeout: false,
					});
				else {
					this.setGameState({
						state: 'select',
						status: `${this.getCluesLeft()} clues left. ${this.gameState.players[
							this.gameState.control
						].getName()} to select a clue`,
					});
					this.unlockAll();
				}
			},
		},
		//buzz: a player is buzzed in
		buzz: {
			//can only come from clueLive - buzzer is disarmed
			data: {
				buzzerArmed: false,
			},
			player: (p) => {
				//if this player is not the buzzed in player, update their stats
				if (p !== this.gameState.buzzedIn) {
					const curr = this.getCurrentClueStats();
					//only do this the first time they hit the buzzer if they're late
					if (curr.data.length <= p || curr.data[p].buzz) return;
					const elapsed = Date.now() - this.gameState.buzzerTime;
					//has someone already buzzed in? find someone who has buzzed in first
					const rt = curr.data.find((d) => d.first);
					// max reaction time -
					// if you buzz in more than a second after the first player
					// your buzz will not count towards game stats, reaction time, etc.
					const mrt = rt ? rt.time + 1000 : 1000;
					if (elapsed <= mrt) {
						this.updateGameStats(p, { buzz: true, time: elapsed });
					}
				}
			},
			correct: this.handleResponse(true),
			incorrect: this.handleResponse(false),
		},
		//waitingDD: showing DD screen, waiting for a DD wager
		waitingDD: {
			data: { modal: 'dd-wager-modal', modalDescription: 'Enter DD Wager' },
			setWager: (wager) => {
				if (this.gameState.control === -1)
					throw new Error('Invalid game state');
				//make sure a valid wager has been submitted,
				const minWager = 5;
				const minMaxWager = (this.gameState.round + 1) * 1000;
				const p = this.gameState.players[this.gameState.control];
				const maxWager = Math.max(minMaxWager, p.getScore());
				if (wager < minWager || wager > maxWager)
					throw new Error(
						`Please submit a valid wager from $${minWager} to $${maxWager}`,
					);
				//valid wager has been submitted - show the clue
				this.setGameState({
					wager,
					state: 'showDD',
				});
			},
		},
		//showDD: DD being read, no timer, no buzzers
		showDD: {
			data: {
				status: `Reading Daily Double clue - press advance to start timer`,
			},
			host: () => {
				this.setGameState({
					state: 'DDLive',
				});
				this.startClueTimer(ddTime, {
					state: 'DDTimedOut',
					timeout: true,
					playSound: true,
				});
			},
		},
		//DDLive: DD is live, buzzers not active
		DDLive: {
			data: {
				status: `Waiting for Daily Double response`,
			},
			correct: () => {
				this.handleDDResponse(true);
			},
			incorrect: () => {
				this.handleDDResponse(false);
			},
		},
		DDTimedOut: {
			data: {
				status:
					'Daily Double timed out. Indicate whether correct response was given to continue.',
			},
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
				selectedClue: [-1, -1],
				timeout: false,
				status: `Between rounds. Press advance to continue`,
			},
			host: () => {
				//entering final jeopardy
				if (this.gameState.round === this.gameState.board.length - 1) {
					//make sure at least one player is eligible for FJ
					if (this.gameState.players.some((p) => p.getScore() > 0)) {
						this.setGameState({
							state: 'FJIntro',
							status: 'Introducing final Jeopardy. Press advance to continue.',
						});
					} else {
						this.setGameState({
							state: 'endGame',
							message: 'No player was eligible for Final Jeopardy.',
						});
					}
				}
				//entering next round
				else
					this.setGameState({
						state: 'boardIntro',
						categoryShown: -1,
					});
			},
		},
		FJIntro: {
			host: () => {
				this.gameData.push({
					round: 3,
					data: new Array(3).fill(0).map(() => {
						return {
							correct: false,
							result: 0,
						};
					}),
				});
				this.setGameState({
					state: 'FJCategory',
					playSound: true,
				});
			},
		},
		//FJCategory: showing FJ category, waiting for wagers
		FJCategory: {
			data: {
				status: 'Showing Final Jeopardy category. Enter wagers.',
				data: { modal: 'fj-wager-modal', modalDescription: 'Enter FJ Wagers' },
			},
			host: () => {
				//make sure valid wagers have been submitted for anyone still in the game
				const inv = this.gameState.players.find(
					(p) =>
						p.getScore() > 0 &&
						(p.getFinalWager() < 0 || p.getFinalWager() > p.getScore()),
				);
				if (inv)
					throw new Error(`Invalid or missing wager from ${inv.getName()}`);

				//valid wager has been submitted - show the clue
				this.setGameState({
					state: 'showFJ',
					status: `Showing Final Jeopardy - press advance to start timer.`,
				});
			},
			setWager: (wagers) => {
				//find any invalid wager
				const inv = wagers.find((w) => {
					//if the player index is valid
					if (w.player >= 0 && w.player < this.gameState.players.length) {
						//if the score is not positive, the wager is ignored
						//if the wager is in the correct range, we're good
						if (
							this.gameState.players[w.player].getScore() <= 0 ||
							(w.wager >= 0 &&
								w.wager <= this.gameState.players[w.player].getScore())
						) {
							this.gameState.players[w.player].finalWager = w.wager || 0;
							return false;
						}
					}
					//otherwise, this wager is invalid
					return true;
				});
				if (inv) {
					throw new Error(
						`Invalid wager data for player ${this.gameState.players[
							inv.player
						].getName()}`,
					);
				} else {
					this.setGameState({
						state: 'showFJ',
					});
				}
			},
		},
		//showfJ: showing FJ clue, timer not live
		showFJ: {
			data: {
				status: `Showing Final Jeopardy - press advance to start timer.`,
			},
			host: () => {
				const fjOrder = this.gameState.players
					.map((p, i) => {
						return {
							...p,
							index: i,
						};
					})
					.filter((p) => p.score > 0)
					.sort((a, b) => {
						for (var i = 0; i < a.scoreHistory.length; i++) {
							const diff = a.scoreHistory[i] - b.scoreHistory[i];
							if (diff !== 0) return diff;
						}
						return a.index - b.index;
					})
					.map((el) => el.index);
				this.setGameState({
					state: 'FJLive',
					fjOrder,
					playSound: true,
				});
				this.startClueTimer(FJTime, {
					state: 'FJOver',
					fjStep: -1,
					fjLock: true,
				});
			},
		},
		//FJLive: showing FJ clue, timer live
		FJLive: {
			data: {
				status: `Final Jeopardy is live.`,
				modal: 'fj-response-modal',
				modalDescription: 'Enter FJ Responses',
			},
			host: () => {
				if (this.environment === 'development') {
					this.setGameState({
						state: 'FJOver',
					});
				} else return;
			},
			setFJResponses: (responses) => {
				responses.forEach((res) => {
					this.gameState.players[res.player].finalResponse = res.response;
				});
				this.updateGameState(null, { players: this.gameState.players });
			},
			setFJResponse: (player, response) => {
				if (player >= 0 && player < this.gameState.players.length) {
					this.gameState.players[player].finalResponse = response;
				}
			},
		},
		FJOver: {
			data: {
				status: `Final Jeopardy timer has expired. Host may finish entering responses.`,
				modal: 'fj-response-modal',
				modalDescription: 'Enter FJ Responses',
			},
			host: () => {
				const maxStep = this.gameState.fjOrder.length * 4 - 1;

				if (this.gameState.fjStep % 4 === 1) return;
				const { category, text, response } = this.gameState.board[2];
				const fjData = `${category.toUpperCase()}<br>${text}<br>${response}`;

				if (this.gameState.fjStep < maxStep) {
					const fjStep = this.gameState.fjStep + 1;
					const fjPlayer =
						this.gameState.players[
							this.gameState.fjOrder[Math.floor(fjStep / 4)]
						];
					const fjSubstep = fjStep % 4;

					const newStatus =
						fjSubstep === 0
							? `Revealing Final Jeopardy for ${fjPlayer.name}. Press advance to continue.`
							: fjSubstep === 1
								? `${fjPlayer.name}'s Final Jeopardy response revealed. Press correct/incorrect to set result.`
								: fjSubstep === 2
									? `${fjPlayer.name}'s Final Jeopardy wager revealed. Press advance to continue`
									: `${fjPlayer.name}'s result set. Press advance to continue.`;
					if (fjSubstep === 3) {
						const ind =
							this.gameState.fjOrder[Math.floor(this.gameState.fjStep / 4)];
						const p = this.gameState.players[ind];
						p.setScore(p.getScore() + (p.finalCorrect ? 1 : -1) * p.finalWager);
					}
					this.setGameState({
						fjStep,
						players: this.gameState.players,
						status: `${fjData}<br><br>${newStatus}`,
					});
				} else {
					const maxScore = this.gameState.players.reduce((p, c) => {
						if (c.score > p) return c.score;
						return p;
					}, 0);
					const winners = this.gameState.players
						.filter((p) => p.score === maxScore)
						.map((p) => p.name);

					const newStatus = `${winners.join(', ')} ${
						winners.length === 1 ? 'wins' : 'win'
					} with $${maxScore.toLocaleString('en')}`;
					this.setGameState({
						state: 'endGame',
						status: newStatus,
						players: this.gameState.players,
						gameData: this.gameData,
						message: 'The game has ended',
					});
				}
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
				this.gameState = null;
				this.updateGameState();
			},
		},
	};

	refreshJoinCode = () => {
		const badWords = require('./badWords');
		this.joinCode = '';

		while (this.joinCode === '') {
			this.joinCode = randomString(4, letters);
			if (badWords.some((re) => this.joinCode.match(re))) this.joinCode = '';
		}

		if (this.gameState) this.gameState.joinCode = this.joinCode;
	};

	constructor(board, host, io, socket, stateHandler, environment) {
		this.id = randomString(20, chars);
		if (process.env.NODE_ENV === 'development') this.joinCode = 'A';
		else if (io) this.refreshJoinCode();
		// this.joinCode = 'A';
		this.io = io;
		this.socket = socket;
		this.environment = environment;
		if (this.environment === 'production') cluesPerRound = 30;
		else cluesPerRound = testClues;
		if (this.socket) {
			this.socket.on('update-game-state', (data) => {
				if (data.reset) {
					delete data.reset;
					if (this.stateHandler) this.stateHandler.setState(data);
				} else if (data.cancelGame && this.stateHandler)
					this.stateHandler.setState(null);
				else if (this.stateHandler) {
					const state = this.stateHandler.getState();
					const newState = {
						...state,
						...data,
					};
					this.stateHandler.setState(newState);
				}
				this.setGameState(data);
			});
		}
		this.stateHandler = stateHandler;
		this.isRemote = io ? true : false;
		this.clueTimeout = null;

		//see if any clues are forced to be DDs
		let dd1c, dd1r;
		dd1c = board[0].findIndex((cat) => {
			dd1r = cat.clues.findIndex((clue) => clue.dailyDouble);
			return dd1r >= 0;
		});
		//and if not, randomize them by distribution
		if (dd1c < 0) {
			dd1c = Math.floor(Math.random() * board[0].length);
			dd1r = generateRandom(ddDistribution[0]);
		}

		//find the columns where daily doubles are located
		const dd2c = [];
		const dd2r = [];
		board[1].some((cat, i) => {
			const clue = cat.clues.findIndex((c) => c.dailyDouble);
			if (clue >= 0) {
				dd2c.push(i);
				dd2r.push(clue);
			}
			if (dd2c.length === 2) return true;
		});

		//if there aren't two...
		if (dd2c.length < 2) {
			//iterate through the categories
			for (var i = 0; i < board[1].length; i++) {
				//if the category already has a DD, move on
				if (dd2c.some((cat) => cat === i)) continue;
				//otherwise, decide whether it should get a DD
				//number of candidate categories remaining, from here to the right
				const categoriesLeft =
					board[1].length - i - (dd2c.length === 1 && dd2c[0] > i ? 1 : 0);
				//number of DDs left to set divided by categories left should be the probability that a DD gets into this column
				if (Math.random() <= (2 - dd2c.length) / categoriesLeft) {
					//if it does, randomly decide the row where the DD should go, using the distribution
					dd2c.push(i);
					dd2r.push(generateRandom(ddDistribution[1]));
				}
				if (dd2c.length === 2) break;
			}
		}

		this.pregameStatus = `Pregame - ${
			this.isRemote
				? 'share join code or have players join locally'
				: 'enter player names on main screen'
		}, test the buzzers, then press "advance" when ready.${
			this.isRemote
				? `<br><br>Join code: <br><span class="join-code">${this.joinCode.toUpperCase()}</span>`
				: ''
		}`;
		this.gameData = [];
		this.gameState = {
			active: false, //whether the game is active
			state: 'pregame',
			status: this.pregameStatus,
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
			id: this.id,
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
			fjPrefix: 'What is',
			round: -1,
			ddTime,
			clueTime,
			FJTime,
			spectators: [],
			// modal: 'cancel-game-modal',
			// modalDescription: 'Cancel game',
		};

		for (var i = 0; i < 3; i++) {
			this.addBlankPlayer();
		}
		// start in FJ for testing
		// this.gameState.active = true;
		// this.gameState.state = 'betweenRounds';
		// this.gameState.round = 2;
		// this.gameState.players.forEach((p, i) => {
		// 	p.score = (i + 1) * 200;
		// });
		/******************/

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

	getGameData(items) {
		const toReturn = {};
		items.forEach((item) => (toReturn[item] = this.gameState[item]));
		return toReturn;
	}

	//update the state handler.
	//if it's the host for a remote game (io is not null), send the new state
	updateGameState(player, data) {
		const toSendPre = data || this.gameState;
		const toSend = {
			...toSendPre,
			message: this.gameState.message,
			playSound: this.gameState.playSound,
		};
		if (this.stateHandler) this.stateHandler.setState(this.gameState);
		if (this.io?.to) {
			if (
				(typeof player).toLowerCase() === 'number' &&
				player >= 0 &&
				player < this.gameState.players.length
			) {
				const p = this.gameState.players[player];
				if (!p.socketId)
					this.io
						.to(this.gameState.host.socketId)
						.emit('update-game-state', toSend);
				else this.io.to(p.socketId).emit('update-game-state', toSend);
			} else if (player === -1) {
				if (this.gameState.host?.socketId)
					this.io
						.to(this.gameState.host.socketId)
						.emit('update-game-state', toSend);
			} else this.io.to(this.getId()).emit('update-game-state', toSend);
		}
		this.gameState.playSound = false;
	}

	isRemote() {
		return this.isRemote;
	}

	addPlayer(name, nameData, id) {
		if (this.gameState.players.length >= 3) return;
		const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
		const toAdd = new Player(
			name,
			nameData,
			id || randomString(20, chars),
			null,
			keys[this.gameState.players.length],
			false,
		);
		this.gameState.players.push(toAdd);
		this.updateGameState(null, { players: this.gameState.players });
	}

	addBlankPlayer() {
		this.addPlayer('', null, null);
	}

	acceptNewPlayer(data) {
		const ind = this.gameState.players.findIndex((p) => p.name === '');
		if (ind === -1) throw new Error('Game is full');
		else {
			const player = this.gameState.players[ind];
			player.setName(data.name);
			player.setNameData(data.nameData);
			player.setSocketId(data.socketId);
			player.setUID(data.uid);
			player.setRemote(true);
		}
	}

	resetPlayer(index) {
		if (this.gameState.players.length > index && index >= 0) {
			const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
			this.gameState.players[index].setName('');
			this.gameState.players[index].uid = randomString(20, chars);
			this.gameState.players[index].nameData = [];
			this.gameState.players[index].setKey(keys[index]);
			this.gameState.players[index].setRemote(this.isRemote);
			this.gameState.players[index].setSocketId(null);
			this.updateGameState(null, { players: this.gameState.players });
		}
	}

	shufflePlayers() {
		if (this.gameState.state !== 'pregame') return;
		const temp = this.gameState.players.map((p) => {
			return {
				player: p,
				order: p.name ? Math.random() : 2,
			};
		});
		temp.sort((a, b) => a.order - b.order);
		this.gameState.players = temp.map((p) => {
			return p.player;
		});
		this.updateGameState(null, { players: this.gameState.players });
	}

	movePlayer(player, direction) {
		const p1 = this.gameState.players[player];
		const player2 =
			direction === 'up' ? player - 1 : direction === 'down' ? player + 1 : NaN;
		if (isNaN(player2)) return;
		const p2 = this.gameState.players[player2];
		if (!p1.name || !p2.name) return;

		[this.gameState.players[player], this.gameState.players[player2]] = [
			this.gameState.players[player2],
			this.gameState.players[player],
		];

		this.updateGameState(null, { players: this.gameState.players });
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
		this.updateGameState(null, { players: this.gameState.players });
	}

	handleInput(...args) {
		if (args.length === 0) return;
		//the input
		const fn = args.shift();
		//the current game state
		const gs = this.gameState.state;
		//the function to run as a result
		let st = this.stateMap[gs];
		if (!st) throw new Error(`Invalid game state (${gs})`);
		let f = st[fn];
		if (!f) f = this.stateMap.all[fn];
		//invalid input for this state - don't do anything
		if (!f) return;
		f(...args);
	}

	setGameState(state) {
		let newData = {};
		let action;
		this.gameState.modal = '';
		this.gameState.modalDescription = '';
		//if we are entering a new general game state, populate the basic data
		if (state.state && state.gameState !== this.gameState.state) {
			const newState = state.state;
			if (this.stateMap[newState]?.data) {
				newData = this.stateMap[newState].data;
				if (this.stateMap[newState].action)
					action = this.stateMap[newState].action;
			}
		}
		this.gameState = {
			...this.gameState,
			...state,
			...newData,
		};
		if (action) action();
		this.updateGameState(null, {
			...state,
			...newData,
			players: this.gameState.players,
		});
		if (this.gameState.message) this.gameState.message = '';
		if (this.gameState.playSound) this.gameState.playSound = false;
	}

	setPlayerScore(player, score) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].setScore(score);
		this.updateGameState(null, { players: this.gameState.players });
	}

	setPlayerKey(player, key) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].setKey(key);
		this.updateGameState(player, { players: this.gameState.players });
	}

	modifyPlayerScore(player, diff) {
		if (player >= this.gameState.players.length) return this.gameState;
		else this.gameState.players[player].modifyScore(diff);
		this.updateGameState(null, { players: this.gameState.players });
	}

	lockPlayer(player, autoUnlock) {
		if (player >= 0 && player < this.gameState.players.length) {
			this.gameState.players[player].locked = true;
			this.updateGameState(player, { players: this.gameState.players });
			if (autoUnlock)
				setTimeout(() => {
					this.gameState.players[player].locked = false;
				}, lockTimeout);
		}
	}

	unlockAll() {
		this.gameState.players.forEach((p) => {
			p.locked = false;
		});
		this.updateGameState(null, { players: this.gameState.players });
	}

	unlockPlayer(player) {
		if (player >= 0 && player < this.gameState.players.length) {
			this.gameState.players[player].locked = false;
			this.updateGameState(player, { players: this.gameState.players });
		}
	}

	unlockAll() {
		this.gameState.players.forEach((p) => {
			p.locked = false;
		});
		this.updateGameState(null, { players: this.gameState.players });
	}

	handleClueTimeout(nextState) {
		if (this.clueTimeout) clearTimeout(this.clueTimeout);
		this.clueTimeout = null;
		this.setGameState({
			...nextState,
			timeout: true,
			playSound: nextState.state !== 'FJOver',
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

	setDDWager(wager) {
		if (this.gameState.state !== 'waitingDD') return;
		else if (this.gameState.control === -1) return;
		const player = this.gameState.players[this.gameState.control];
		if (wager < 5) throw new Error('Minimum wager is $5');
		const maxWager = Math.max(
			(this.gameState.round + 1) * 1000,
			player.getScore(),
		);
		if (wager > maxWager) throw new Error(`Maximum wager is $${maxWager}`);
		this.gameState.wager = wager;
	}
}

try {
	module.exports = Game;
} catch (err) {}
